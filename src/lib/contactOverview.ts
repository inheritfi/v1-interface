import type { ContactStatus } from "./contactStatus";
import { t, type MessageKey } from "../i18n";

/**
 * Overview of the recovery contact . The same as the heir's: each asset is summarized with a label and a line
 * from the SAME state that its panel shows (contactStatus).
 */
export type ContactGroup = "action" | "waiting" | "finished" | "error";

export type ContactLabel =
  | "Recover now"
  | "Ready to recover"
  | "Ready to start"
  | "Started"
  | "Owner active"
  | "Nothing to recover"
  | "Can't be shown";

export type ContactLine =
  | { kind: "takeover-now" }
  | { kind: "takeover-from"; date: bigint }
  | { kind: "no-heirs" }
  | { kind: "no-activity-since"; date: bigint }
  | { kind: "inheritance-in-progress" }
  | { kind: "recover-from"; date: bigint }
  | { kind: "nothing-yet" }
  | { kind: "can-start-from"; date: bigint }
  | { kind: "no-balance" }
  | { kind: "error" };

export interface ContactEntry {
  group: ContactGroup;
  label: ContactLabel;
  line: ContactLine;
  /** Order within the group: first the rank (kind of stage), then the date. */
  rank: number;
  date: bigint;
}

/** `status`: state of the asset, or an Error if it could not be interpreted. */
export function contactEntry(status: ContactStatus | Error): ContactEntry {
  if (status instanceof Error) return { group: "error", label: "Can't be shown", line: { kind: "error" }, rank: 0, date: 0n };
  switch (status.kind) {
    case "can-recover":
      if (status.takeoverNow) return { group: "action", label: "Recover now", line: { kind: "takeover-now" }, rank: 0, date: status.startedAt };
      return status.takeoverAt === null
        ? { group: "action", label: "Ready to recover", line: { kind: "no-heirs" }, rank: 1, date: status.startedAt }
        : { group: "action", label: "Ready to recover", line: { kind: "takeover-from", date: status.takeoverAt }, rank: 1, date: status.takeoverAt };
    case "can-start":
      return status.inheritanceInProgress
        ? { group: "action", label: "Ready to start", line: { kind: "inheritance-in-progress" }, rank: 2, date: status.lastActivity }
        : { group: "action", label: "Ready to start", line: { kind: "no-activity-since", date: status.lastActivity }, rank: 2, date: status.lastActivity };
    case "started":
      return { group: "waiting", label: "Started", line: { kind: "recover-from", date: status.recoverFrom }, rank: 0, date: status.recoverFrom };
    case "started-empty":
      return { group: "waiting", label: "Started", line: { kind: "nothing-yet" }, rank: 0, date: status.recoverFrom };
    case "waiting":
      return { group: "waiting", label: "Owner active", line: { kind: "can-start-from", date: status.canStartAt }, rank: 0, date: status.canStartAt };
    case "nothing":
      return { group: "finished", label: "Nothing to recover", line: { kind: "no-balance" }, rank: 0, date: 0n };
  }
}

const GROUP_ORDER: Record<ContactGroup, number> = { action: 0, waiting: 1, finished: 2, error: 3 };

const CONTACT_GROUP_TITLES: Record<ContactGroup, MessageKey> = {
  action: "overview.groupAction",
  waiting: "overview.groupWaiting",
  finished: "overview.groupFinished",
  error: "overview.groupError",
};

/** Title of the group in the list, in the current language. */
export function contactGroupTitle(g: ContactGroup): string {
  return t(CONTACT_GROUP_TITLES[g]);
}

/** The labels are stable identifiers (the logic and the tests compare them); this is their text on screen. */
const CONTACT_LABEL_TEXT: Record<ContactLabel, MessageKey> = {
  "Recover now": "contactLabel.recoverNow",
  "Ready to recover": "contactLabel.readyToRecover",
  "Ready to start": "contactLabel.readyToStart",
  Started: "contactLabel.started",
  "Owner active": "contactLabel.ownerActive",
  "Nothing to recover": "contactLabel.nothingToRecover",
  "Can't be shown": "contactLabel.cantBeShown",
};

export function contactLabelText(label: ContactLabel): string {
  return t(CONTACT_LABEL_TEXT[label]);
}

/** Order of the list: group, rank, date (the closest first) and, in a tie, the order of the manifest (`index`). */
export function compareContactEntries(a: { entry: ContactEntry; index: number }, b: { entry: ContactEntry; index: number }): number {
  const g = GROUP_ORDER[a.entry.group] - GROUP_ORDER[b.entry.group];
  if (g !== 0) return g;
  if (a.entry.rank !== b.entry.rank) return a.entry.rank - b.entry.rank;
  if (a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? -1 : 1;
  return a.index - b.index;
}

export interface ContactCounts {
  recover: number;
  start: number;
  waiting: number;
  finished: number;
  error: number;
}

export function contactCounts(entries: readonly ContactEntry[]): ContactCounts {
  const c: ContactCounts = { recover: 0, start: 0, waiting: 0, finished: 0, error: 0 };
  for (const e of entries) {
    if (e.label === "Recover now" || e.label === "Ready to recover") c.recover++;
    else if (e.label === "Ready to start") c.start++;
    else if (e.group === "waiting") c.waiting++;
    else if (e.group === "finished") c.finished++;
    else c.error++;
  }
  return c;
}

/** "1 ready to recover · 2 ready to start · 24 waiting · 1 finished" (only the parts that are not zero). */
export function contactSummaryText(c: ContactCounts): string {
  const parts: string[] = [];
  if (c.recover > 0) parts.push(t("overview.readyToRecover", { count: c.recover }));
  if (c.start > 0) parts.push(t("overview.readyToStart", { count: c.start }));
  if (c.waiting > 0) parts.push(t("overview.waiting", { count: c.waiting }));
  if (c.finished > 0) parts.push(t("overview.finished", { count: c.finished }));
  if (c.error > 0) parts.push(t("overview.error", { count: c.error }));
  return parts.join(t("overview.separator"));
}
