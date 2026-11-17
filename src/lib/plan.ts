// INHERITFI: state of an owner's plan in an asset, derived from what the contract returns.
// Rules taken from the code of v1-core (InheritfiV1Base.sol and InheritfiV1InheritanceLib.sol):
//  - the inactivity periods count from activityTimestamp (Lib l. 127 and 345);
//  - recovery and inheritance in progress are mutually exclusive (Lib l. 118-125 and 346-348);
//  - a recovery is executed from startRecoveryTimestamp + recoveryWaitingTime (Lib l. 369);
//  - the heirs claim from startInheritanceTimestamp + inheritWaitingTime (Lib l. 155) and the
//    remaining funds from + inheritRemainingWaitingTime (Lib l. 196).
// Times in Unix seconds (bigint), percentages and taxes in basis points (10000 = 100 %).

import { computeSuccession, type Succession } from "./succession";

export interface Heir {
  wallet: `0x${string}`;
  bps: bigint;
}

/** What the contract returns for an account in an asset. */
export interface PlanReads {
  balance: bigint;
  activityTimestamp: bigint;
  inheritanceStarted: boolean;
  inheritanceStartTimestamp: bigint;
  recoveryStarted: boolean;
  recoveryStartTimestamp: bigint;
  inheritanceClaimsClosed: boolean;
  heirs: readonly Heir[];
  recoveryUsers: readonly `0x${string}`[];
}

/** Protocol parameters in that asset (set by the owner of the contract within limits). */
export interface ProtocolParams {
  recoveryInactivityPeriod: bigint;
  inheritInactivityPeriod: bigint;
  inheritWaitingTime: bigint;
  inheritRemainingWaitingTime: bigint;
  recoveryWaitingTime: bigint;
  recoveryExecutionWindow: bigint;
  wrappingTax: bigint;
  unwrappingTax: bigint;
  inheritanceTax: bigint;
  recoveryTax: bigint;
  maxHeirs: bigint;
  maxRecoveryUsers: bigint;
}

export type PlanStatus =
  /** Without heirs or recovery contacts: when the periods pass nothing happens. */
  | { kind: "no-plan" }
  /** Plan configured and without processes in progress; `succession` says which periods have already passed. */
  | { kind: "idle"; succession: Succession; canRecover: boolean; canInherit: boolean }
  /** A contact started a recovery; it can be executed from `executableAt`. */
  | { kind: "recovery-started"; startedAt: bigint; executableAt: bigint }
  /** The heirs started the inheritance; they claim from `claimsFrom`; the remaining funds from `remainingFrom`. */
  | { kind: "inheritance-started"; startedAt: bigint; claimsFrom: bigint; remainingFrom: bigint }
  /** The inheritance claims were closed (the remaining funds were split). */
  | { kind: "inheritance-closed" };

/** Checks that what was read is consistent; if not, the interface must not interpret it. */
export function validatePlan(r: PlanReads, p: ProtocolParams): void {
  if (r.inheritanceStarted && r.recoveryStarted) {
    throw new Error("Inconsistent plan: inheritance and recovery both started");
  }
  if (p.recoveryInactivityPeriod <= 0n || p.recoveryInactivityPeriod >= p.inheritInactivityPeriod) {
    throw new Error("Inconsistent periods: recovery must be shorter than inheritance");
  }
  const total = r.heirs.reduce((sum, h) => sum + h.bps, 0n);
  if (r.heirs.length > 0 && total !== 10_000n) {
    throw new Error("Inconsistent plan: heir shares don't add up to 100%");
  }
  if (r.heirs.some((h) => h.bps <= 0n)) {
    throw new Error("Inconsistent plan: heir share must be positive");
  }
}

export function planStatus(r: PlanReads, p: ProtocolParams, now: bigint): PlanStatus {
  validatePlan(r, p);
  if (r.inheritanceClaimsClosed) {
    return { kind: "inheritance-closed" };
  }
  if (r.recoveryStarted) {
    return {
      kind: "recovery-started",
      startedAt: r.recoveryStartTimestamp,
      executableAt: r.recoveryStartTimestamp + p.recoveryWaitingTime,
    };
  }
  if (r.inheritanceStarted) {
    const claimsFrom = r.inheritanceStartTimestamp + p.inheritWaitingTime;
    return {
      kind: "inheritance-started",
      startedAt: r.inheritanceStartTimestamp,
      claimsFrom,
      remainingFrom: claimsFrom + p.inheritRemainingWaitingTime,
    };
  }
  if (r.heirs.length === 0 && r.recoveryUsers.length === 0) {
    return { kind: "no-plan" };
  }
  const succession = computeSuccession({
    lastActivity: r.activityTimestamp,
    recoveryPeriod: p.recoveryInactivityPeriod,
    inheritancePeriod: p.inheritInactivityPeriod,
    now,
  });
  return {
    kind: "idle",
    succession,
    canRecover: r.recoveryUsers.length > 0 && succession.phase !== "active",
    canInherit: r.heirs.length > 0 && r.balance > 0n && succession.phase === "inheritance-open",
  };
}
