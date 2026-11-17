import { describe, expect, it } from "vitest";
import { planStatus, type PlanReads, type ProtocolParams } from "./plan";

const DAY = 86_400n;
const T0 = 1_790_000_000n;
const HEIR_A = "0x00000000000000000000000000000000000000A1";
const HEIR_B = "0x00000000000000000000000000000000000000B2";
const CONTACT = "0x00000000000000000000000000000000000000C3";

/** Example values within the limits of the contract (the initial ones before AUD3; the current ones are 30 and 45 days, 30 heirs and 15 contacts). */
const params: ProtocolParams = {
  recoveryInactivityPeriod: 15n * DAY,
  inheritInactivityPeriod: 30n * DAY,
  inheritWaitingTime: 7n * DAY,
  inheritRemainingWaitingTime: 14n * DAY,
  recoveryWaitingTime: 7n * DAY,
  recoveryExecutionWindow: 30n * DAY,
  wrappingTax: 30n,
  unwrappingTax: 30n,
  inheritanceTax: 30n,
  recoveryTax: 30n,
  maxHeirs: 15n,
  maxRecoveryUsers: 10n,
};

function reads(over: Partial<PlanReads> = {}): PlanReads {
  return {
    balance: 10n ** 18n,
    activityTimestamp: T0,
    inheritanceStarted: false,
    inheritanceStartTimestamp: 0n,
    recoveryStarted: false,
    recoveryStartTimestamp: 0n,
    inheritanceClaimsClosed: false,
    heirs: [
      { wallet: HEIR_A, bps: 6_000n },
      { wallet: HEIR_B, bps: 4_000n },
    ],
    recoveryUsers: [CONTACT],
    ...over,
  };
}

describe("planStatus", () => {
  it("without heirs or contacts there is no plan, even if there is balance", () => {
    expect(planStatus(reads({ heirs: [], recoveryUsers: [], activityTimestamp: 0n }), params, T0)).toEqual({ kind: "no-plan" });
  });

  it("the periods open at the exact second, as in the contract (>=)", () => {
    const at = (t: bigint) => planStatus(reads(), params, t);
    const idle = (t: bigint) => {
      const s = at(t);
      if (s.kind !== "idle") throw new Error(s.kind);
      return s;
    };
    expect(idle(T0 + 15n * DAY - 1n).canRecover).toBe(false);
    expect(idle(T0 + 15n * DAY).canRecover).toBe(true);
    expect(idle(T0 + 30n * DAY - 1n).canInherit).toBe(false);
    expect(idle(T0 + 30n * DAY).canInherit).toBe(true);
    expect(idle(T0 + 30n * DAY).succession.phase).toBe("inheritance-open");
  });

  it("without contacts no recovery is possible; without balance no inheritance is possible", () => {
    const s1 = planStatus(reads({ recoveryUsers: [] }), params, T0 + 40n * DAY);
    const s2 = planStatus(reads({ balance: 0n }), params, T0 + 40n * DAY);
    if (s1.kind !== "idle" || s2.kind !== "idle") throw new Error("expected idle");
    expect(s1.canRecover).toBe(false);
    expect(s1.canInherit).toBe(true);
    expect(s2.canInherit).toBe(false);
  });

  it("recovery in progress: it is executed from start + recoveryWaitingTime", () => {
    const start = T0 + 20n * DAY;
    expect(planStatus(reads({ recoveryStarted: true, recoveryStartTimestamp: start }), params, start)).toEqual({
      kind: "recovery-started",
      startedAt: start,
      executableAt: start + 7n * DAY,
    });
  });

  it("inheritance in progress: claims from start + 7 days and remaining funds 14 days later", () => {
    const start = T0 + 31n * DAY;
    expect(planStatus(reads({ inheritanceStarted: true, inheritanceStartTimestamp: start }), params, start)).toEqual({
      kind: "inheritance-started",
      startedAt: start,
      claimsFrom: start + 7n * DAY,
      remainingFrom: start + 21n * DAY,
    });
  });

  it("claims closed takes priority", () => {
    const r = reads({ inheritanceStarted: true, inheritanceStartTimestamp: T0, inheritanceClaimsClosed: true });
    expect(planStatus(r, params, T0)).toEqual({ kind: "inheritance-closed" });
  });

  it("rejects inconsistent data instead of interpreting it", () => {
    expect(() => planStatus(reads({ inheritanceStarted: true, recoveryStarted: true }), params, T0)).toThrow(/both started/);
    expect(() => planStatus(reads({ heirs: [{ wallet: HEIR_A, bps: 9_999n }] }), params, T0)).toThrow(/100%/);
    expect(() => planStatus(reads({ heirs: [{ wallet: HEIR_A, bps: 10_000n }, { wallet: HEIR_B, bps: 0n }] }), params, T0)).toThrow(
      /positive/,
    );
    expect(() => planStatus(reads(), { ...params, recoveryInactivityPeriod: 30n * DAY }, T0)).toThrow(/shorter/);
  });
});
