import { describe, expect, it } from "vitest";
import { heirStatus, type HeirInfo, type HeirParams, type OwnerAssetReads } from "./heirStatus";

const DAY = 86_400n;
const T0 = 1_790_000_000n;
const ME = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const;
const OTHER = "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as const;
const P: HeirParams = { inheritInactivityPeriod: 30n * DAY, inheritWaitingTime: 7n * DAY, inheritRemainingWaitingTime: 14n * DAY, recoveryExecutionWindow: 30n * DAY, inheritanceTax: 30n };
const base: OwnerAssetReads = {
  balance: 1_000n,
  activityTimestamp: T0,
  inheritanceStarted: false,
  inheritanceStartTimestamp: 0n,
  recoveryStarted: false,
  recoveryStartTimestamp: 0n,
  inheritanceClaimsClosed: false,
};
const heir = (wallet: `0x${string}`, bps: bigint, over: Partial<HeirInfo> = {}): HeirInfo => ({ wallet, bps, released: 0n, received: false, potential: 0n, potentialRemaining: 0n, ...over });
const two = (me: Partial<HeirInfo> = {}, other: Partial<HeirInfo> = {}) => [heir(ME, 6_000n, me), heir(OTHER, 4_000n, other)];
const START = T0 + 31n * DAY;
const started: OwnerAssetReads = { ...base, inheritanceStarted: true, inheritanceStartTimestamp: START };

describe("heirStatus", () => {
  it("the owner is still active: wait until activity + 30 days (exact to the second)", () => {
    expect(heirStatus(base, P, two(), ME, T0 + 30n * DAY - 1n)).toEqual({ kind: "waiting", lastActivity: T0, canStartAt: T0 + 30n * DAY });
    expect(heirStatus(base, P, two(), ME, T0 + 30n * DAY).kind).toBe("can-start");
  });

  it("without balance it cannot be started (No balance)", () => {
    expect(heirStatus({ ...base, balance: 0n }, P, two(), ME, T0 + 40n * DAY)).toEqual({ kind: "no-balance" });
  });

  it("recovery in progress blocks until its window expires; then it can be started", () => {
    const r = { ...base, recoveryStarted: true, recoveryStartTimestamp: T0 + 20n * DAY };
    expect(heirStatus(r, P, two(), ME, T0 + 40n * DAY)).toEqual({ kind: "recovery-active", recoveryStartedAt: T0 + 20n * DAY, blockedUntil: T0 + 50n * DAY });
    expect(heirStatus(r, P, two(), ME, T0 + 50n * DAY).kind).toBe("can-start");
  });

  it("started: claims from start + 7 days; rest from + 14 more days", () => {
    expect(heirStatus(started, P, two({ potential: 598n }), ME, START + 1n)).toEqual({
      kind: "started",
      startedAt: START,
      claimsFrom: START + 7n * DAY,
      restFrom: START + 21n * DAY,
      estimate: 598n,
    });
    expect(heirStatus(started, P, two({ potential: 598n }), ME, START + 7n * DAY)).toEqual({ kind: "can-claim", startedAt: START, potential: 598n, restFrom: START + 21n * DAY });
  });

  it("already claimed: waits for the rest; then can claim it, with how many claimed and how many did not", () => {
    const h = two({ received: true, released: 600n, potentialRemaining: 398n });
    expect(heirStatus({ ...started, balance: 400n }, P, h, ME, START + 20n * DAY)).toEqual({ kind: "claimed", startedAt: START, released: 600n, restFrom: START + 21n * DAY });
    expect(heirStatus({ ...started, balance: 400n }, P, h, ME, START + 21n * DAY)).toEqual({
      kind: "can-claim-rest",
      startedAt: START,
      released: 600n,
      potentialRemaining: 398n,
      remaining: 400n,
      claimedCount: 1,
      unclaimedCount: 1,
      claimsClosed: false,
    });
    expect(heirStatus({ ...started, balance: 0n }, P, h, ME, START + 30n * DAY)).toEqual({ kind: "done", released: 600n });
  });

  it("design A-03: the process stays started after closing the claims; the balance that arrives afterwards is new remaining funds", () => {
    const h = two({ received: true, released: 600n, potentialRemaining: 49n }, { received: false });
    const closed = { ...started, inheritanceClaimsClosed: true };
    expect(heirStatus({ ...closed, balance: 0n }, P, h, ME, START + 40n * DAY)).toEqual({ kind: "done", released: 600n });
    expect(heirStatus({ ...closed, balance: 50n }, P, h, ME, START + 400n * DAY)).toEqual({
      kind: "can-claim-rest",
      startedAt: START,
      released: 600n,
      potentialRemaining: 49n,
      remaining: 50n,
      claimedCount: 1,
      unclaimedCount: 1,
      claimsClosed: true,
    });
    // The heir that did not claim before the closing can no longer claim in this process.
    expect(heirStatus({ ...closed, balance: 50n }, P, two({}, { received: true }), ME, START + 400n * DAY)).toEqual({ kind: "missed" });
  });

  it("a claim of 0 is valid (it counts for the remaining funds): with balance 0 it is still 'can-claim'", () => {
    expect(heirStatus({ ...started, balance: 0n }, P, two({ potential: 0n }), ME, START + 7n * DAY)).toEqual({ kind: "can-claim", startedAt: START, potential: 0n, restFrom: START + 21n * DAY });
  });

  it("claims closed without having claimed: lost in this process", () => {
    expect(heirStatus({ ...started, balance: 0n, inheritanceClaimsClosed: true }, P, two({}, { received: true }), ME, START + 30n * DAY)).toEqual({ kind: "missed" });
  });

  it("the address is compared case-insensitively", () => {
    expect(heirStatus(base, P, two(), ME.toLowerCase(), T0).kind).toBe("waiting");
  });

  it("rejects inconsistent data", () => {
    expect(() => heirStatus({ ...started, recoveryStarted: true }, P, two(), ME, START)).toThrow(/both started/);
    expect(() => heirStatus(base, P, [heir(ME, 5_000n)], ME, T0)).toThrow(/Inconsistent heirs/);
    expect(() => heirStatus(base, P, [], ME, T0)).toThrow(/Inconsistent heirs/);
    expect(() => heirStatus(base, P, [heir(OTHER, 10_000n)], ME, T0)).toThrow(/not an heir/);
    expect(() => heirStatus(base, P, two({ received: true }), ME, T0)).toThrow(/claims without/);
  });
});
