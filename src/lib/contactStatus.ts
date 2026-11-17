// INHERITFI: what a recovery contact can do in an asset, derived from what the contract returns.
// Rules of v1-core (InheritfiV1Base.sol MD5 b545aa2b…, InheritfiV1InheritanceLib.sol MD5 100f1247…):
//  - startRecovery (Lib l. 337-352): be a contact (onlyRecoveryUser); no recovery started; activityTimestamp +
//    recoveryInactivityPeriod reached. It can be started with balance 0 (OBS-01). If there is an inheritance in progress, it cancels it.
//  - executeRecovery (Lib l. 359-381): recovery started; startRecoveryTimestamp + recoveryWaitingTime reached;
//    owner's balance > 0. It delivers the balance minus recoveryTax (tax = balance * rate / 10000) to the contact that executes and
//    ends the recovery (it can be started again: the owner's clock is not renewed, N-5).
//  - An heir can only take over a started recovery (startInheritance, Lib l. 117-128) with
//    startRecoveryTimestamp + recoveryExecutionWindow and activityTimestamp + inheritInactivityPeriod reached, with
//    heirs and with balance > 0.
// All the periods and the fee are read from the contract on each read (they are global and adjustable): none is fixed here.
// Times in Unix seconds (bigint); fee in basis points.

const BP = 10_000n;

export interface ContactParams {
  recoveryInactivityPeriod: bigint;
  recoveryWaitingTime: bigint;
  recoveryExecutionWindow: bigint;
  inheritInactivityPeriod: bigint;
  recoveryTax: bigint;
}

/** What was read from the owner in the asset (getUserInfo, balanceOf and getRecoveryUsers). */
export interface ContactOwnerReads {
  balance: bigint;
  activityTimestamp: bigint;
  heirCount: bigint;
  inheritanceStarted: boolean;
  recoveryStarted: boolean;
  recoveryStartTimestamp: bigint;
  contacts: readonly `0x${string}`[];
}

export type ContactStatus =
  /** The owner is still active: the recovery can be started from `canStartAt`. */
  | { kind: "waiting"; lastActivity: bigint; canStartAt: bigint }
  /** It can be started. `inheritanceInProgress`: starting it cancels the inheritance in progress. */
  | { kind: "can-start"; lastActivity: bigint; balance: bigint; inheritanceInProgress: boolean }
  /** It can be started, but the owner has no balance and there is no inheritance in progress ("Nothing to recover"). */
  | { kind: "nothing"; lastActivity: bigint }
  /** Recovery started; it can be recovered from `recoverFrom`. */
  | { kind: "started"; startedAt: bigint; recoverFrom: bigint; balance: bigint }
  /** Recovery started and it could already be recovered, but the owner has no balance. */
  | { kind: "started-empty"; startedAt: bigint; recoverFrom: bigint }
  /**
   * It can be recovered now: `net` (balance minus `fee`) for the contact that executes first. `takeoverAt`: from when
   * an heir can take over the recovery (null if the owner has no heirs in this asset).
   */
  | {
      kind: "can-recover";
      startedAt: bigint;
      balance: bigint;
      fee: bigint;
      net: bigint;
      takeoverAt: bigint | null;
      takeoverNow: boolean;
      contactCount: number;
    };

/** Checks that what was read is consistent before interpreting it. */
export function validateContactReads(o: ContactOwnerReads, me: string, recoveryUserCount: bigint): void {
  if (o.inheritanceStarted && o.recoveryStarted) throw new Error("Inconsistent state: inheritance and recovery both started");
  if (BigInt(o.contacts.length) !== recoveryUserCount) throw new Error("Recovery contact count does not match the list");
  if (!o.contacts.some((c) => c.toLowerCase() === me.toLowerCase())) throw new Error("This wallet is not a recovery contact of this owner in this asset");
  if (o.recoveryStarted && o.recoveryStartTimestamp === 0n) throw new Error("Inconsistent state: recovery started without a date");
  if (!o.recoveryStarted && o.recoveryStartTimestamp !== 0n) throw new Error("Inconsistent state: recovery date without a recovery");
}

/** What the contact that recovers receives: same calculation as the contract (tax = balance * rate / 10000, rounding down). */
export function recoverySplit(balance: bigint, recoveryTax: bigint): { fee: bigint; net: bigint } {
  if (balance < 0n || recoveryTax < 0n || recoveryTax > BP) throw new Error("Invalid amount or fee");
  const fee = (balance * recoveryTax) / BP;
  return { fee, net: balance - fee };
}

export function contactStatus(o: ContactOwnerReads, p: ContactParams, me: string, recoveryUserCount: bigint, now: bigint): ContactStatus {
  validateContactReads(o, me, recoveryUserCount);
  if (o.recoveryStarted) {
    const startedAt = o.recoveryStartTimestamp;
    const recoverFrom = startedAt + p.recoveryWaitingTime;
    if (now < recoverFrom) return { kind: "started", startedAt, recoverFrom, balance: o.balance };
    if (o.balance === 0n) return { kind: "started-empty", startedAt, recoverFrom };
    const { fee, net } = recoverySplit(o.balance, p.recoveryTax);
    const window = startedAt + p.recoveryExecutionWindow;
    const inactive = o.activityTimestamp + p.inheritInactivityPeriod;
    const takeoverAt = o.heirCount > 0n ? (window > inactive ? window : inactive) : null;
    return {
      kind: "can-recover",
      startedAt,
      balance: o.balance,
      fee,
      net,
      takeoverAt,
      takeoverNow: takeoverAt !== null && now >= takeoverAt,
      contactCount: o.contacts.length,
    };
  }
  const canStartAt = o.activityTimestamp + p.recoveryInactivityPeriod;
  if (now < canStartAt) return { kind: "waiting", lastActivity: o.activityTimestamp, canStartAt };
  if (o.balance === 0n && !o.inheritanceStarted) return { kind: "nothing", lastActivity: o.activityTimestamp };
  return { kind: "can-start", lastActivity: o.activityTimestamp, balance: o.balance, inheritanceInProgress: o.inheritanceStarted };
}
