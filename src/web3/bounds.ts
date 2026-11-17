import { isAddressEqual, zeroAddress, type Address } from "viem";

/**
 * INHERITFI: rules that the deployed code of v1-core (v1.0.0) imposes on the values the interface reads.
 * The contracts are immutable: a value that does not meet these rules cannot come from them. If a read
 * contradicts them, it is rejected (the reader throws an error and the screen shows its read-error notice) instead of
 * being shown. Each limit cites the file and the line of the contract that sets it.
 */

const DAY = 86_400n;

/** InheritfiV1Base.sol l. 27 (BP) y InheritfiV1InheritanceLib.sol l. 19. */
export const BP = 10_000n;
/** InheritfiV1Base.sol l. 28; the four fee setters require it (l. 542-557). */
export const MAX_TAX = 30n;
/** InheritfiV1Base.sol l. 29 (MIN_P): minimum gap between the wait and the window of the recovery (l. 472, 478). */
export const MIN_GAP = 3n * DAY;

/** Ranges of the periods: constants of InheritfiV1Base.sol l. 29-35 and their setters (l. 448-481). */
export const PERIOD_BOUNDS = {
  recoveryInactivityPeriod: { min: 14n * DAY, max: 180n * DAY }, // MIN_REC_INAC, MAX_INAC; l. 449
  inheritInactivityPeriod: { min: 21n * DAY, max: 180n * DAY }, // MIN_INH_INAC, MAX_INAC; l. 455
  inheritWaitingTime: { min: 3n * DAY, max: 90n * DAY }, // MIN_P, MAX_P; l. 461
  inheritRemainingWaitingTime: { min: 3n * DAY, max: 90n * DAY }, // MIN_P, MAX_P; l. 466
  recoveryWaitingTime: { min: 2n * DAY, max: 90n * DAY }, // MIN_REC_P, MAX_P; l. 471
  recoveryExecutionWindow: { min: 7n * DAY, max: 90n * DAY }, // MIN_REX_P, MAX_P; l. 477
} as const;

export type PeriodName = keyof typeof PERIOD_BOUNDS;

/** Absolute caps of the lists: setMaxHeirs (l. 524), setMaxRecoveryUsers (l. 528) and setMaxTreasuries (l. 532). */
export const MAX_HEIRS_CAP = 40n;
export const MAX_RECOVERY_USERS_CAP = 50n;
export const MAX_TREASURIES_CAP = 40n;

function reject(what: string): never {
  throw new Error(`Value contradicts the deployed contracts: ${what}`);
}

/** wrappingTax, unwrappingTax, inheritanceTax and recoveryTax: from 0 to MAX_TAX. */
export function checkTax(name: string, v: bigint): bigint {
  if (v < 0n || v > MAX_TAX) reject(`${name} = ${String(v)}`);
  return v;
}

/** A period within its range. */
export function checkPeriod(name: PeriodName, v: bigint): bigint {
  const b = PERIOD_BOUNDS[name];
  if (v < b.min || v > b.max) reject(`${name} = ${String(v)}`);
  return v;
}

/**
 * Relations between periods that both setters of each pair always keep (they are checked only if both were read):
 * recoveryInactivityPeriod < inheritInactivityPeriod (l. 450 and 456) and
 * recoveryWaitingTime + MIN_GAP <= recoveryExecutionWindow (l. 472 and 478).
 */
export function checkPeriodRelations(p: Partial<Record<PeriodName, bigint>>): void {
  const { recoveryInactivityPeriod: ri, inheritInactivityPeriod: ii, recoveryWaitingTime: rw, recoveryExecutionWindow: rx } = p;
  if (ri !== undefined && ii !== undefined && !(ri < ii)) reject("recoveryInactivityPeriod must be below inheritInactivityPeriod");
  if (rw !== undefined && rx !== undefined && !(rw + MIN_GAP <= rx)) reject("recoveryWaitingTime + 3 days must not exceed recoveryExecutionWindow");
}

/** maxHeirs (from 1 to 40) and maxRecoveryUsers (from 1 to 50). */
export function checkMaxHeirs(v: bigint): bigint {
  if (v < 1n || v > MAX_HEIRS_CAP) reject(`maxHeirs = ${String(v)}`);
  return v;
}
export function checkMaxRecoveryUsers(v: bigint): bigint {
  if (v < 1n || v > MAX_RECOVERY_USERS_CAP) reject(`maxRecoveryUsers = ${String(v)}`);
  return v;
}

/** Non-null addresses, different from `excluded` and without repeats. */
function checkAddresses(what: string, list: readonly Address[], excluded: Address): void {
  const seen = new Set<string>();
  for (const a of list) {
    if (isAddressEqual(a, zeroAddress) || isAddressEqual(a, excluded)) reject(`${what} contains a forbidden address`);
    const k = a.toLowerCase();
    if (seen.has(k)) reject(`${what} contains a repeated address`);
    seen.add(k);
  }
}

/** Percentages from 1 to BP that sum exactly BP (or none). */
function checkShares(what: string, pcts: readonly bigint[]): void {
  if (pcts.length === 0) return;
  let total = 0n;
  for (const p of pcts) {
    if (p < 1n || p > BP) reject(`${what} has a share out of range`);
    total += p;
  }
  if (total !== BP) reject(`${what} shares do not add up to 100%`);
}

/**
 * getHeirs(owner): none or from 1 to 40; each heir non-null, different from the owner and from the others; percentages from
 * 1 to 10 000 that sum 10 000 (InheritfiV1InheritanceLib.sol setHeirs, l. 44-69; cap of l. 524).
 */
export function checkHeirs(owner: Address, wallets: readonly Address[], pcts: readonly bigint[]): void {
  if (wallets.length !== pcts.length) reject("getHeirs lists of different length");
  if (BigInt(wallets.length) > MAX_HEIRS_CAP) reject("too many heirs");
  checkAddresses("getHeirs", wallets, owner);
  checkShares("getHeirs", pcts);
}

/**
 * getRecoveryUsers(owner): none or from 1 to 50; each contact non-null, different from the owner and from the others
 * (InheritfiV1InheritanceLib.sol setRecoveryUsers, l. 84-95; cap of l. 528).
 */
export function checkContacts(owner: Address, contacts: readonly Address[]): void {
  if (BigInt(contacts.length) > MAX_RECOVERY_USERS_CAP) reject("too many recovery contacts");
  checkAddresses("getRecoveryUsers", contacts, owner);
}

/**
 * getTreasuries: none (before the first setTreasuries) or from 1 to 40; each wallet non-null, different from the contract itself
 * and from the others; percentages from 1 to 10 000 that sum 10 000 (InheritfiV1GovernanceLib.sol setTreasuries, l. 60-79;
 * the wallet change, l. 94-126, requires a non-null address that is not already a treasury and the signature of that address;
 * cap of InheritfiV1Base.sol l. 532).
 */
export function checkTreasuries(contract: Address, wallets: readonly Address[], pcts: readonly bigint[]): void {
  if (wallets.length !== pcts.length) reject("getTreasuries lists of different length");
  if (BigInt(wallets.length) > MAX_TREASURIES_CAP) reject("too many treasuries");
  checkAddresses("getTreasuries", wallets, contract);
  checkShares("getTreasuries", pcts);
}
