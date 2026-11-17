import { describe, expect, it } from "vitest";
import { contactStatus, recoverySplit, type ContactOwnerReads, type ContactParams } from "./contactStatus";

const ME = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const OTHER = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const DAY = 86_400n;
// Default values of the contract, only for the tests: the interface always uses the ones it reads.
const P: ContactParams = { recoveryInactivityPeriod: 15n * DAY, recoveryWaitingTime: 7n * DAY, recoveryExecutionWindow: 30n * DAY, inheritInactivityPeriod: 30n * DAY, recoveryTax: 30n };
const A = 1_000_000n; // last activity
const base: ContactOwnerReads = { balance: 1_000n, activityTimestamp: A, heirCount: 2n, inheritanceStarted: false, recoveryStarted: false, recoveryStartTimestamp: 0n, contacts: [ME] };
const st = (o: Partial<ContactOwnerReads>, now: bigint, p: ContactParams = P, count?: bigint) => {
  const r = { ...base, ...o };
  return contactStatus(r, p, ME, count ?? BigInt(r.contacts.length), now);
};

describe("contactStatus", () => {
  it("owner active until activity + recoveryInactivityPeriod (the exact second already allows starting)", () => {
    expect(st({}, A + 15n * DAY - 1n)).toEqual({ kind: "waiting", lastActivity: A, canStartAt: A + 15n * DAY });
    expect(st({}, A + 15n * DAY)).toEqual({ kind: "can-start", lastActivity: A, balance: 1_000n, inheritanceInProgress: false });
  });

  it("uses the periods read, not the default ones", () => {
    const p = { ...P, recoveryInactivityPeriod: 15n * DAY + 12n * 3_600n };
    expect(st({}, A + 15n * DAY, p).kind).toBe("waiting");
    expect(st({}, A + 15n * DAY + 12n * 3_600n, p).kind).toBe("can-start");
  });

  it("without balance and without inheritance: 'nothing' (it can be started anyway); with inheritance in progress: can-start that cancels it", () => {
    expect(st({ balance: 0n }, A + 20n * DAY)).toEqual({ kind: "nothing", lastActivity: A });
    expect(st({ balance: 0n, inheritanceStarted: true }, A + 40n * DAY)).toEqual({ kind: "can-start", lastActivity: A, balance: 0n, inheritanceInProgress: true });
    expect(st({ inheritanceStarted: true }, A + 40n * DAY)).toEqual({ kind: "can-start", lastActivity: A, balance: 1_000n, inheritanceInProgress: true });
  });

  it("started: waits recoveryWaitingTime; then, recover (or nothing to recover if the balance is 0)", () => {
    const S = A + 16n * DAY;
    const r = { recoveryStarted: true, recoveryStartTimestamp: S };
    expect(st(r, S + 7n * DAY - 1n)).toEqual({ kind: "started", startedAt: S, recoverFrom: S + 7n * DAY, balance: 1_000n });
    expect(st({ ...r, balance: 0n }, S + 7n * DAY - 1n).kind).toBe("started");
    expect(st({ ...r, balance: 0n }, S + 7n * DAY)).toEqual({ kind: "started-empty", startedAt: S, recoverFrom: S + 7n * DAY });
    const c = st(r, S + 7n * DAY);
    expect(c).toMatchObject({ kind: "can-recover", startedAt: S, balance: 1_000n, fee: 3n, net: 997n, takeoverNow: false, contactCount: 1 });
  });

  it("heirs can take it over from max(start + window, activity + inheritance inactivity); without heirs, never", () => {
    const S = A + 16n * DAY;
    const r = { recoveryStarted: true, recoveryStartTimestamp: S };
    expect(st(r, S + 7n * DAY)).toMatchObject({ takeoverAt: S + 30n * DAY, takeoverNow: false });
    expect(st(r, S + 30n * DAY)).toMatchObject({ takeoverAt: S + 30n * DAY, takeoverNow: true });
    // Short window and long inheritance inactivity: the inactivity rules.
    const p = { ...P, recoveryExecutionWindow: 8n * DAY, inheritInactivityPeriod: 90n * DAY };
    expect(st(r, S + 10n * DAY, p)).toMatchObject({ takeoverAt: A + 90n * DAY, takeoverNow: false });
    expect(st({ ...r, heirCount: 0n }, S + 60n * DAY)).toMatchObject({ kind: "can-recover", takeoverAt: null, takeoverNow: false });
  });

  it("several contacts: contactCount", () => {
    const S = A + 16n * DAY;
    expect(st({ recoveryStarted: true, recoveryStartTimestamp: S, contacts: [OTHER, ME] }, S + 7n * DAY)).toMatchObject({ contactCount: 2 });
  });

  it("rejects inconsistent data", () => {
    expect(() => st({ inheritanceStarted: true, recoveryStarted: true, recoveryStartTimestamp: 1n }, A)).toThrow(/both started/);
    expect(() => st({ contacts: [OTHER] }, A)).toThrow(/not a recovery contact/);
    expect(() => st({}, A, P, 2n)).toThrow(/count does not match/);
    expect(() => st({ recoveryStarted: true, recoveryStartTimestamp: 0n }, A)).toThrow(/without a date/);
    expect(() => st({ recoveryStartTimestamp: 5n }, A)).toThrow(/without a recovery/);
  });

  it("compares the address case-insensitively", () => {
    expect(contactStatus({ ...base, contacts: [ME] }, P, ME.toLowerCase(), 1n, A).kind).toBe("waiting");
  });
});

describe("recoverySplit", () => {
  it("the same as the contract: fee rounded down", () => {
    expect(recoverySplit(1_000n, 30n)).toEqual({ fee: 3n, net: 997n });
    expect(recoverySplit(333n, 30n)).toEqual({ fee: 0n, net: 333n });
    expect(recoverySplit(1_000_000_000_000_000_000n, 30n)).toEqual({ fee: 3_000_000_000_000_000n, net: 997_000_000_000_000_000n });
    expect(recoverySplit(0n, 30n)).toEqual({ fee: 0n, net: 0n });
    expect(() => recoverySplit(1n, 10_001n)).toThrow();
  });
});
