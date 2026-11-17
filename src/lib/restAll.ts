import type { HeirStatus } from "./heirStatus";

/**
 * "Claim the rest in all": executeInheritanceRemaining in each
 * asset with "Claim the rest" available, one signature per asset (useTx.runSequence). Before signing, a joint
 * summary with the figures of each asset is always shown:
 *   - "close": some asset has open claims with heirs that have not claimed; claiming the rest closes the claims
 *     for everyone in that asset (notice and button "Close claims and claim the rest").
 *   - "receive": in none is anyone left without claiming (claims already closed, new remaining funds A-03, or everyone already claimed).
 * Each asset, as in its panel (HeirScreen, can-claim-rest): "close" if the claims are still open and someone did not claim;
 * "closed" if they were already closed; "receive" if they are still open but everyone already claimed.
 */
export type RestStatus = Extract<HeirStatus, { kind: "can-claim-rest" }>;
export type RestLineKind = "close" | "closed" | "receive";
export type RestMode = "close" | "receive";

/** Button visible only with 2 or more assets with "Claim the rest" available (like "Start all" and "Claim all"). */
export const REST_ALL_MIN = 2;

export const restLineKind = (s: RestStatus): RestLineKind => (s.claimsClosed ? "closed" : s.unclaimedCount > 0 ? "close" : "receive");

/** Mode of the summary and how many assets close claims with heirs that have not claimed. */
export function restSummary(items: readonly RestStatus[]): { mode: RestMode; closing: number } {
  const closing = items.filter((s) => restLineKind(s) === "close").length;
  return { mode: closing > 0 ? "close" : "receive", closing };
}

/** Line of each asset according to the mode: without closing, all of them are "receive". */
export const restLine = (mode: RestMode, s: RestStatus): RestLineKind => (mode === "receive" ? "receive" : restLineKind(s));
