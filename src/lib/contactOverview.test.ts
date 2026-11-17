import { describe, expect, it } from "vitest";
import { compareContactEntries, contactCounts, contactEntry, contactSummaryText } from "./contactOverview";
import type { ContactStatus } from "./contactStatus";

const all: ContactStatus[] = [
  { kind: "waiting", lastActivity: 100n, canStartAt: 900n },
  { kind: "nothing", lastActivity: 50n },
  { kind: "can-start", lastActivity: 60n, balance: 1n, inheritanceInProgress: false },
  { kind: "can-start", lastActivity: 40n, balance: 0n, inheritanceInProgress: true },
  { kind: "started", startedAt: 100n, recoverFrom: 700n, balance: 1n },
  { kind: "started-empty", startedAt: 100n, recoverFrom: 600n },
  { kind: "can-recover", startedAt: 100n, balance: 10n, fee: 0n, net: 10n, takeoverAt: 3_000n, takeoverNow: false, contactCount: 1 },
  { kind: "can-recover", startedAt: 90n, balance: 10n, fee: 0n, net: 10n, takeoverAt: 500n, takeoverNow: true, contactCount: 2 },
  { kind: "can-recover", startedAt: 80n, balance: 10n, fee: 0n, net: 10n, takeoverAt: null, takeoverNow: false, contactCount: 1 },
];

describe("contactEntry", () => {
  it("each state has its approved group, label and line", () => {
    expect(all.map((s) => { const e = contactEntry(s); return `${e.group}:${e.label}:${e.line.kind}`; })).toEqual([
      "waiting:Owner active:can-start-from",
      "finished:Nothing to recover:no-balance",
      "action:Ready to start:no-activity-since",
      "action:Ready to start:inheritance-in-progress",
      "waiting:Started:recover-from",
      "waiting:Started:nothing-yet",
      "action:Ready to recover:takeover-from",
      "action:Recover now:takeover-now",
      "action:Ready to recover:no-heirs",
    ]);
    expect(contactEntry(new Error("x"))).toEqual({ group: "error", label: "Can't be shown", line: { kind: "error" }, rank: 0, date: 0n });
  });
});

describe("order and summary", () => {
  it("action by urgency, then waiting by date, then finished; tie by the order of the manifest", () => {
    const entries = all.map((s, index) => ({ entry: contactEntry(s), index }));
    expect([...entries].sort(compareContactEntries).map((x) => `${x.entry.label}@${String(x.index)}`)).toEqual([
      "Recover now@7",
      "Ready to recover@8",
      "Ready to recover@6",
      "Ready to start@3",
      "Ready to start@2",
      "Started@5",
      "Started@4",
      "Owner active@0",
      "Nothing to recover@1",
    ]);
    const e = contactEntry(all[0] ?? new Error("x"));
    expect(compareContactEntries({ entry: e, index: 2 }, { entry: e, index: 7 })).toBeLessThan(0);
  });

  it("summary with only the parts that are not zero", () => {
    const c = contactCounts(all.map((s) => contactEntry(s)));
    expect(c).toEqual({ recover: 3, start: 2, waiting: 3, finished: 1, error: 0 });
    expect(contactSummaryText(c)).toBe("3 ready to recover · 2 ready to start · 3 waiting · 1 finished");
    expect(contactSummaryText({ recover: 0, start: 0, waiting: 27, finished: 0, error: 1 })).toBe("27 waiting · 1 couldn't be read");
  });
});
