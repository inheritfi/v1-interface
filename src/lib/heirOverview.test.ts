import { describe, expect, it } from "vitest";
import { compareEntries, overviewCounts, overviewEntry, summaryText, type OverviewEntry } from "./heirOverview";
import type { HeirStatus } from "./heirStatus";

const all: HeirStatus[] = [
  { kind: "waiting", lastActivity: 100n, canStartAt: 900n },
  { kind: "recovery-active", recoveryStartedAt: 100n, blockedUntil: 800n },
  { kind: "no-balance" },
  { kind: "can-start", lastActivity: 50n },
  { kind: "started", startedAt: 100n, claimsFrom: 700n, restFrom: 1_500n, estimate: 1n },
  { kind: "can-claim", startedAt: 100n, potential: 1n, restFrom: 1_500n },
  { kind: "can-claim", startedAt: 100n, potential: 1n, restFrom: 900n },
  { kind: "claimed", startedAt: 100n, released: 1n, restFrom: 1_200n },
  { kind: "can-claim-rest", startedAt: 100n, released: 1n, potentialRemaining: 1n, remaining: 5n, claimedCount: 1, unclaimedCount: 1, claimsClosed: false },
  { kind: "done", released: 9n },
  { kind: "missed" },
];

describe("overviewEntry", () => {
  it("each state has its approved group, label and line", () => {
    const now = 1_000n;
    const got = all.map((s) => {
      const e = overviewEntry(s, now);
      return `${e.group}:${e.label}:${e.line.kind}`;
    });
    expect(got).toEqual([
      "waiting:Owner active:can-start",
      "waiting:Recovery in progress:recovery",
      "finished:Nothing to inherit:no-balance",
      "action:Ready to start:no-activity-since",
      "waiting:Started:claims-open",
      "action:Ready to claim:claim-before",
      "action:Claim now:claim-now",
      "waiting:Claimed:rest-from",
      "action:Rest available:rest-left",
      "finished:Received:received",
      "finished:Claims closed:missed",
    ]);
    expect(overviewEntry(new Error("x"), now).group).toBe("error");
  });

  it("'Rest available' with the claims already closed: shared remaining-funds line", () => {
    const s: HeirStatus = { kind: "can-claim-rest", startedAt: 0n, released: 1n, potentialRemaining: 1n, remaining: 7n, claimedCount: 1, unclaimedCount: 1, claimsClosed: true };
    expect(overviewEntry(s, 0n)).toEqual({ group: "action", label: "Rest available", line: { kind: "rest-shared", amount: 7n }, rank: 3, date: 0n });
  });

  it("'Claim now' starts exactly at restFrom (the second before is still 'Ready to claim')", () => {
    const s: HeirStatus = { kind: "can-claim", startedAt: 0n, potential: 1n, restFrom: 1_000n };
    expect(overviewEntry(s, 999n).label).toBe("Ready to claim");
    expect(overviewEntry(s, 1_000n).label).toBe("Claim now");
  });
});

describe("order and summary", () => {
  it("action by urgency, then waiting by date, then finished; tie by the order of the manifest", () => {
    const now = 1_000n;
    const entries = all.map((s, index) => ({ entry: overviewEntry(s, now), index }));
    const order = [...entries].sort(compareEntries).map((x) => `${x.entry.label}@${String(x.index)}`);
    expect(order).toEqual([
      "Claim now@6",
      "Ready to claim@5",
      "Ready to start@3",
      "Rest available@8",
      "Started@4",
      "Recovery in progress@1",
      "Owner active@0",
      "Claimed@7",
      "Received@9",
      "Claims closed@10",
      "Nothing to inherit@2",
    ]);
    const same: OverviewEntry = { group: "waiting", label: "Owner active", line: { kind: "can-start", date: 5n }, rank: 0, date: 5n };
    expect(compareEntries({ entry: same, index: 2 }, { entry: same, index: 7 })).toBeLessThan(0);
  });

  it("summary with only the parts that are not zero", () => {
    const now = 1_000n;
    const c = overviewCounts(all.map((s) => overviewEntry(s, now)));
    expect(c).toEqual({ claim: 2, start: 1, rest: 1, waiting: 4, finished: 3, error: 0 });
    expect(summaryText(c)).toBe("2 ready to claim · 1 ready to start · 1 with the rest available · 4 waiting · 3 finished");
    expect(summaryText({ claim: 0, start: 0, rest: 0, waiting: 27, finished: 0, error: 1 })).toBe("27 waiting · 1 couldn't be read");
  });
});
