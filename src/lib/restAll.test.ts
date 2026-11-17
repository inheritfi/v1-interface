import { describe, expect, it } from "vitest";
import { REST_ALL_MIN, restLine, restLineKind, restSummary, type RestStatus } from "./restAll";

const rest = (o: Partial<RestStatus> = {}): RestStatus => ({
  kind: "can-claim-rest",
  startedAt: 1n,
  released: 1n,
  potentialRemaining: 1n,
  remaining: 2n,
  claimedCount: 1,
  unclaimedCount: 1,
  claimsClosed: false,
  ...o,
});

describe("restAll", () => {
  it("each asset as in its panel: it closes if there are open claims and someone did not claim", () => {
    expect(restLineKind(rest())).toBe("close");
    expect(restLineKind(rest({ claimsClosed: true }))).toBe("closed");
    expect(restLineKind(rest({ unclaimedCount: 0, claimedCount: 2 }))).toBe("receive");
    expect(restLineKind(rest({ claimsClosed: true, unclaimedCount: 2 }))).toBe("closed");
  });

  it("one asset that closes is enough for the closing notice (mixed case); without closing, all the lines are 'receive'", () => {
    const mixed = [rest({ claimsClosed: true }), rest(), rest({ unclaimedCount: 0 })];
    expect(restSummary(mixed)).toEqual({ mode: "close", closing: 1 });
    expect(mixed.map((s) => restLine("close", s))).toEqual(["closed", "close", "receive"]);
    const none = [rest({ claimsClosed: true }), rest({ unclaimedCount: 0 })];
    expect(restSummary(none)).toEqual({ mode: "receive", closing: 0 });
    expect(none.map((s) => restLine("receive", s))).toEqual(["receive", "receive"]);
  });

  it("button with 2 or more assets", () => {
    expect(REST_ALL_MIN).toBe(2);
  });
});
