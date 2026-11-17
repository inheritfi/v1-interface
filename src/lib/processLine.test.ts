import { describe, expect, it } from "vitest";
import { contactLine, heirLine, placeNow, type ProcessStep } from "./processLine";

const DAY = 86_400n;
const A = 1_000_000n;
// Default values of the contract, only for the tests: the interface always uses the ones it reads.
const heirBase = {
  activityTimestamp: A,
  inheritanceStarted: false,
  inheritanceStartTimestamp: 0n,
  recoveryStarted: false,
  recoveryStartTimestamp: 0n,
  inheritInactivityPeriod: 30n * DAY,
  inheritWaitingTime: 7n * DAY,
  inheritRemainingWaitingTime: 14n * DAY,
  recoveryExecutionWindow: 30n * DAY,
};
const contactBase = {
  activityTimestamp: A,
  heirCount: 2n,
  recoveryStarted: false,
  recoveryStartTimestamp: 0n,
  recoveryInactivityPeriod: 15n * DAY,
  recoveryWaitingTime: 7n * DAY,
  recoveryExecutionWindow: 30n * DAY,
  inheritInactivityPeriod: 30n * DAY,
};
const view = (l: ReturnType<typeof heirLine>) => l.steps.map((s) => `${s.title}:${s.when.kind === "at" ? String(s.when.at) : `+${String(s.when.period)}${s.when.notBefore === null ? "" : `>=${String(s.when.notBefore)}`}`}`);

describe("placeNow", () => {
  const steps: ProcessStep[] = [
    { key: "a", title: "a", when: { kind: "at", at: 100n } },
    { key: "b", title: "b", when: { kind: "at", at: 200n } },
    { key: "c", title: "c", when: { kind: "after-start", period: 10n, notBefore: null } },
  ];
  it("stage reached and proportional progress between two known dates", () => {
    expect(placeNow(steps, 150n)).toMatchObject({ reached: 0, fraction: 0.5 });
    expect(placeNow(steps, 100n)).toMatchObject({ reached: 0, fraction: 0 });
    expect(placeNow(steps, 199n)).toMatchObject({ reached: 0, fraction: 0.99 });
  });
  it("if the next stage has no date, the progress is 0; before the first one, none reached", () => {
    expect(placeNow(steps, 500n)).toMatchObject({ reached: 1, fraction: 0 });
    expect(placeNow(steps, 50n)).toMatchObject({ reached: -1, fraction: 0 });
  });
});

describe("heirLine", () => {
  it("not started: it can start at activity + inactivity; the claims, periods from the start", () => {
    const l = heirLine(heirBase, A + 10n * DAY);
    expect(view(l)).toEqual([`Owner last active:${String(A)}`, `Inheritance can start:${String(A + 30n * DAY)}`, `Claims open:+${String(7n * DAY)}`, `Rest available:+${String(21n * DAY)}`]);
    expect(l.reached).toBe(0);
    expect(l.fraction).toBeCloseTo(1 / 3, 3);
  });
  it("with a recovery started it cannot start before its window expires", () => {
    const S = A + 20n * DAY;
    const l = heirLine({ ...heirBase, recoveryStarted: true, recoveryStartTimestamp: S }, S);
    expect(l.steps[1]?.when).toEqual({ kind: "at", at: S + 30n * DAY });
  });
  it("started: real dates of start, claims and rest", () => {
    const S = A + 31n * DAY;
    const l = heirLine({ ...heirBase, inheritanceStarted: true, inheritanceStartTimestamp: S }, S + 8n * DAY);
    expect(view(l)).toEqual([`Owner last active:${String(A)}`, `Inheritance started:${String(S)}`, `Claims open:${String(S + 7n * DAY)}`, `Rest available:${String(S + 21n * DAY)}`]);
    expect(l.reached).toBe(2);
  });
  it("uses the periods read (with hours)", () => {
    const l = heirLine({ ...heirBase, inheritInactivityPeriod: 30n * DAY + 6n * 3_600n }, A);
    expect(l.steps[1]?.when).toEqual({ kind: "at", at: A + 30n * DAY + 6n * 3_600n });
  });
});

describe("contactLine", () => {
  it("not started, with heirs: the takeover is window after the start if that already falls after the inheritance inactivity", () => {
    const l = contactLine(contactBase, A);
    expect(view(l)).toEqual([`Owner last active:${String(A)}`, `Recovery can start:${String(A + 15n * DAY)}`, `You can recover:+${String(7n * DAY)}`, `Heirs can take over:+${String(30n * DAY)}`]);
  });
  it("if the window plus the recovery inactivity does not reach the inheritance one, not before that date either", () => {
    const l = contactLine({ ...contactBase, recoveryExecutionWindow: 8n * DAY, inheritInactivityPeriod: 90n * DAY }, A);
    expect(l.steps[3]?.when).toEqual({ kind: "after-start", period: 8n * DAY, notBefore: A + 90n * DAY });
  });
  it("without heirs there is no takeover stage", () => {
    expect(contactLine({ ...contactBase, heirCount: 0n }, A).steps.map((s) => s.key)).toEqual(["active", "start", "recover"]);
  });
  it("started: recover from start + wait; takeover at max(start + window, activity + inheritance inactivity)", () => {
    const S = A + 16n * DAY;
    const l = contactLine({ ...contactBase, recoveryStarted: true, recoveryStartTimestamp: S }, S + 10n * DAY);
    expect(view(l)).toEqual([`Owner last active:${String(A)}`, `Recovery started:${String(S)}`, `You can recover:${String(S + 7n * DAY)}`, `Heirs can take over:${String(S + 30n * DAY)}`]);
    expect(l.reached).toBe(2);
    const p = contactLine({ ...contactBase, recoveryStarted: true, recoveryStartTimestamp: S, recoveryExecutionWindow: 8n * DAY, inheritInactivityPeriod: 90n * DAY }, S);
    expect(p.steps[3]?.when).toEqual({ kind: "at", at: A + 90n * DAY });
  });
});
