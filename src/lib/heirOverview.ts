import type { HeirStatus } from "./heirStatus";
import { t, type MessageKey } from "../i18n";

/**
 * Overview of the heir. Each asset where the account is
 * an heir is summarized with a label and a line, from the SAME state that its panel shows (heirStatus).
 * Groups: "Needs your action" (by urgency), "Waiting" (by the next date) and "Finished".
 */
export type OverviewGroup = "action" | "waiting" | "finished" | "error";

export type OverviewLabel =
  | "Claim now"
  | "Ready to claim"
  | "Ready to start"
  | "Rest available"
  | "Started"
  | "Claimed"
  | "Owner active"
  | "Recovery in progress"
  | "Received"
  | "Claims closed"
  | "Nothing to inherit"
  | "Can't be shown";

/** Detail line with its data: the screen puts the date or the amount with its format. */
export type OverviewLine =
  | { kind: "claim-now" }
  | { kind: "claim-before"; date: bigint }
  | { kind: "no-activity-since"; date: bigint }
  | { kind: "rest-left"; amount: bigint }
  /** Remaining funds that arrived with the claims already closed (shared among those who claimed). */
  | { kind: "rest-shared"; amount: bigint }
  | { kind: "claims-open"; date: bigint }
  | { kind: "rest-from"; date: bigint }
  | { kind: "can-start"; date: bigint }
  | { kind: "recovery"; date: bigint }
  | { kind: "received"; amount: bigint }
  | { kind: "missed" }
  | { kind: "no-balance" }
  | { kind: "error" };

export interface OverviewEntry {
  group: OverviewGroup;
  label: OverviewLabel;
  line: OverviewLine;
  /** Order within the group: first the rank (kind of stage), then the date. */
  rank: number;
  date: bigint;
}

/** `status`: state of the asset, or an Error if it could not be interpreted. `now`: the same "time" that the panel uses. */
export function overviewEntry(status: HeirStatus | Error, now: bigint): OverviewEntry {
  if (status instanceof Error) return { group: "error", label: "Can't be shown", line: { kind: "error" }, rank: 0, date: 0n };
  switch (status.kind) {
    case "can-claim":
      // From restFrom any heir that already claimed can close the claims at any moment.
      return now >= status.restFrom
        ? { group: "action", label: "Claim now", line: { kind: "claim-now" }, rank: 0, date: status.restFrom }
        : { group: "action", label: "Ready to claim", line: { kind: "claim-before", date: status.restFrom }, rank: 1, date: status.restFrom };
    case "can-start":
      return { group: "action", label: "Ready to start", line: { kind: "no-activity-since", date: status.lastActivity }, rank: 2, date: status.lastActivity };
    case "can-claim-rest":
      return {
        group: "action",
        label: "Rest available",
        line: status.claimsClosed ? { kind: "rest-shared", amount: status.remaining } : { kind: "rest-left", amount: status.remaining },
        rank: 3,
        date: status.startedAt,
      };
    case "started":
      return { group: "waiting", label: "Started", line: { kind: "claims-open", date: status.claimsFrom }, rank: 0, date: status.claimsFrom };
    case "claimed":
      return { group: "waiting", label: "Claimed", line: { kind: "rest-from", date: status.restFrom }, rank: 0, date: status.restFrom };
    case "waiting":
      return { group: "waiting", label: "Owner active", line: { kind: "can-start", date: status.canStartAt }, rank: 0, date: status.canStartAt };
    case "recovery-active":
      return { group: "waiting", label: "Recovery in progress", line: { kind: "recovery", date: status.blockedUntil }, rank: 0, date: status.blockedUntil };
    case "done":
      return { group: "finished", label: "Received", line: { kind: "received", amount: status.released }, rank: 0, date: 0n };
    case "missed":
      return { group: "finished", label: "Claims closed", line: { kind: "missed" }, rank: 1, date: 0n };
    case "no-balance":
      return { group: "finished", label: "Nothing to inherit", line: { kind: "no-balance" }, rank: 2, date: 0n };
  }
}

const GROUP_ORDER: Record<OverviewGroup, number> = { action: 0, waiting: 1, finished: 2, error: 3 };

const GROUP_TITLES: Record<OverviewGroup, MessageKey> = {
  action: "overview.groupAction",
  waiting: "overview.groupWaiting",
  finished: "overview.groupFinished",
  error: "overview.groupError",
};

/** Title of the group in the list, in the current language. */
export function groupTitle(g: OverviewGroup): string {
  return t(GROUP_TITLES[g]);
}

/** The labels are stable identifiers (the logic and the tests compare them); this is their text on screen. */
const LABEL_TEXT: Record<OverviewLabel, MessageKey> = {
  "Claim now": "heirLabel.claimNow",
  "Ready to claim": "heirLabel.readyToClaim",
  "Ready to start": "heirLabel.readyToStart",
  "Rest available": "heirLabel.restAvailable",
  Started: "heirLabel.started",
  Claimed: "heirLabel.claimed",
  "Owner active": "heirLabel.ownerActive",
  "Recovery in progress": "heirLabel.recoveryInProgress",
  Received: "heirLabel.received",
  "Claims closed": "heirLabel.claimsClosed",
  "Nothing to inherit": "heirLabel.nothingToInherit",
  "Can't be shown": "heirLabel.cantBeShown",
};

export function labelText(label: OverviewLabel): string {
  return t(LABEL_TEXT[label]);
}

/** Order of the list: group, rank, date (the closest first) and, in a tie, the order of the manifest (`index`). */
export function compareEntries(a: { entry: OverviewEntry; index: number }, b: { entry: OverviewEntry; index: number }): number {
  const g = GROUP_ORDER[a.entry.group] - GROUP_ORDER[b.entry.group];
  if (g !== 0) return g;
  if (a.entry.rank !== b.entry.rank) return a.entry.rank - b.entry.rank;
  if (a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? -1 : 1;
  return a.index - b.index;
}

export interface OverviewCounts {
  claim: number;
  start: number;
  rest: number;
  waiting: number;
  finished: number;
  error: number;
}

export function overviewCounts(entries: readonly OverviewEntry[]): OverviewCounts {
  const c: OverviewCounts = { claim: 0, start: 0, rest: 0, waiting: 0, finished: 0, error: 0 };
  for (const e of entries) {
    if (e.label === "Claim now" || e.label === "Ready to claim") c.claim++;
    else if (e.label === "Ready to start") c.start++;
    else if (e.label === "Rest available") c.rest++;
    else if (e.group === "waiting") c.waiting++;
    else if (e.group === "finished") c.finished++;
    else c.error++;
  }
  return c;
}

/** "2 ready to claim · 1 ready to start · 24 waiting · 1 finished" (only the parts that are not zero). */
export function summaryText(c: OverviewCounts): string {
  const parts: string[] = [];
  if (c.claim > 0) parts.push(t("overview.readyToClaim", { count: c.claim }));
  if (c.start > 0) parts.push(t("overview.readyToStart", { count: c.start }));
  if (c.rest > 0) parts.push(t("overview.restAvailable", { count: c.rest }));
  if (c.waiting > 0) parts.push(t("overview.waiting", { count: c.waiting }));
  if (c.finished > 0) parts.push(t("overview.finished", { count: c.finished }));
  if (c.error > 0) parts.push(t("overview.error", { count: c.error }));
  return parts.join(t("overview.separator"));
}
