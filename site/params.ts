// INHERITFI: periods and fees that the site shows: the values of the
// deployment, fixed at build time, with the note that the app shows the current ones of each asset.
//
// Source: InheritfiV1Base.sol with AUD3 (md5 0982761f…): initial periods in lines 58–63, initial fees in
// _initBase (lines 224–227, 30 basis points each), the cap MAX_TAX = 30 (line 28), which is a constant of the
// code, and maxHeirs = 30 (line 75; the owner can change it between 1 and 40, setMaxHeirs).

import type { SiteEnv } from "./config";

const DAY = 86_400n;

export interface ProtocolParams {
  readonly recoveryInactivityPeriod: bigint;
  readonly inheritInactivityPeriod: bigint;
  readonly inheritWaitingTime: bigint;
  readonly inheritRemainingWaitingTime: bigint;
  readonly recoveryWaitingTime: bigint;
  readonly recoveryExecutionWindow: bigint;
  /** Basis points (10 000 = 100 %). */
  readonly wrappingTax: bigint;
  readonly unwrappingTax: bigint;
  readonly inheritanceTax: bigint;
  readonly recoveryTax: bigint;
  /** Maximum of heirs per plan at deployment. */
  readonly maxHeirs: bigint;
}

/** Cap of each fee fixed in the code (MAX_TAX, InheritfiV1Base.sol line 28): 0.3 %. Nobody can change it. */
export const MAX_TAX_BPS = 30n;

/**
 * Minimum and maximum, in days, that the contract accepts for each period (constants of the code: nobody changes them).
 * Source: the first require of each setter of InheritfiV1Base.sol with AUD3 (md5 0982761f…, lines 449–477): recovery
 * inactivity MIN_REC_INAC to MAX_INAC, inheritance inactivity MIN_INH_INAC to MAX_INAC, waits MIN_P to MAX_P, recovery wait
 * MIN_REC_P to MAX_P and recovery priority MIN_REX_P to MAX_P: the contract rejects with "Bad period" just below the
 * minimum and just above the maximum.
 */
export const PERIOD_RANGES_DAYS = {
  recoveryInactivityPeriod: { min: 14n, max: 180n, setter: "setRecoveryInactivityPeriod" },
  inheritInactivityPeriod: { min: 21n, max: 180n, setter: "setInheritInactivityPeriod" },
  inheritWaitingTime: { min: 3n, max: 90n, setter: "setInheritWaitingTime" },
  inheritRemainingWaitingTime: { min: 3n, max: 90n, setter: "setInheritRemainingWaitingTime" },
  recoveryWaitingTime: { min: 2n, max: 90n, setter: "setRecoveryWaitingTime" },
  recoveryExecutionWindow: { min: 7n, max: 90n, setter: "setRecoveryExecutionWindow" },
} as const;

export const PARAM_NAMES = [
  "recoveryInactivityPeriod",
  "inheritInactivityPeriod",
  "inheritWaitingTime",
  "inheritRemainingWaitingTime",
  "recoveryWaitingTime",
  "recoveryExecutionWindow",
  "wrappingTax",
  "unwrappingTax",
  "inheritanceTax",
  "recoveryTax",
  "maxHeirs",
] as const satisfies readonly (keyof ProtocolParams)[];

/**
 * Ethereum mainnet: read from the 29 deployed wrappers on 2026-11-12 at block 26,402,990 (identical in all 29).
 * They equal the initial values of the code.
 */
const MAINNET_DEPLOYED: ProtocolParams = {
  recoveryInactivityPeriod: 30n * DAY,
  inheritInactivityPeriod: 45n * DAY,
  inheritWaitingTime: 7n * DAY,
  inheritRemainingWaitingTime: 14n * DAY,
  recoveryWaitingTime: 7n * DAY,
  recoveryExecutionWindow: 30n * DAY,
  wrappingTax: 30n,
  unwrappingTax: 30n,
  inheritanceTax: 30n,
  recoveryTax: 30n,
  maxHeirs: 30n,
};

/** Values per environment. Mainnet: the values read from its 29 wrappers (MAINNET_DEPLOYED). */
const PARAMS: Readonly<Record<SiteEnv, ProtocolParams | null>> = {
  mainnet: MAINNET_DEPLOYED,
};

export function protocolParams(env: SiteEnv): ProtocolParams {
  const p = PARAMS[env];
  if (p === null) throw new Error(`${env}: set the deployed periods and fees in site/params.ts before building`);
  for (const k of ["wrappingTax", "unwrappingTax", "inheritanceTax", "recoveryTax"] as const) {
    if (p[k] > MAX_TAX_BPS) throw new Error(`${env}: ${k} above the contract cap`);
  }
  if (p.recoveryInactivityPeriod >= p.inheritInactivityPeriod) throw new Error(`${env}: recovery must open before inheritance`);
  if (p.maxHeirs < 1n || p.maxHeirs > 40n) throw new Error(`${env}: maxHeirs outside the contract range (1 to 40)`);
  return p;
}

/** Fee in basis points, the same as in the app (formatBasisPoints): 30 → "0.3%", 25 → "0.25%", 100 → "1%". */
export function formatFee(bps: bigint): string {
  if (bps < 0n) throw new Error("Invalid basis points");
  const whole = bps / 100n;
  const fraction = (bps % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return fraction === "" ? `${whole.toString()}%` : `${whole.toString()}.${fraction}%`;
}
