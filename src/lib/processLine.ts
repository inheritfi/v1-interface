// INHERITFI: timeline of the process that an heir or a recovery contact sees (I3j).
// Same language as the plan's succession line: origin (owner's last activity) and stages of the process. The
// stages are at the same distance (their periods are very different and some dates are not known yet); the "now" dot
// is placed between the last stage reached and the next one, in proportion to the time when both dates are known.
// All the periods are read from the contract on each read; none is fixed here.

import { t } from "../i18n";

/** When a stage happens: a known date, or a period counted from the start of the process (not started yet). */
export type StepWhen = { kind: "at"; at: bigint } | { kind: "after-start"; period: bigint; notBefore: bigint | null };

export interface ProcessStep {
  key: string;
  title: string;
  when: StepWhen;
}

export interface ProcessLine {
  steps: ProcessStep[];
  /** Index of the last stage reached (-1 if none, impossible in practice: the first one is the last activity). */
  reached: number;
  /** Progress of the segment between `reached` and the next stage (0 to 1); 0 if the next one has no known date. */
  fraction: number;
}

const at = (step: ProcessStep): bigint | null => (step.when.kind === "at" ? step.when.at : null);

/** Computes the stage reached and the progress from `now` (the same "time" that the panel uses). */
export function placeNow(steps: ProcessStep[], now: bigint): ProcessLine {
  let reached = -1;
  for (const [i, s] of steps.entries()) {
    const t = at(s);
    if (t !== null && now >= t) reached = i;
    else break;
  }
  let fraction = 0;
  const from = reached >= 0 ? steps[reached] : undefined;
  const next = steps[reached + 1];
  if (from !== undefined && next !== undefined) {
    const a = at(from);
    const b = at(next);
    if (a !== null && b !== null && b > a) fraction = Number(((now - a) * 10_000n) / (b - a)) / 10_000;
  }
  return { steps, reached, fraction: Math.min(Math.max(fraction, 0), 1) };
}

export interface HeirLineInput {
  activityTimestamp: bigint;
  inheritanceStarted: boolean;
  inheritanceStartTimestamp: bigint;
  recoveryStarted: boolean;
  recoveryStartTimestamp: bigint;
  inheritInactivityPeriod: bigint;
  inheritWaitingTime: bigint;
  inheritRemainingWaitingTime: bigint;
  recoveryExecutionWindow: bigint;
}

/** Inheritance: last activity → the inheritance can start (or started) → the claims open → rest available. */
export function heirLine(o: HeirLineInput, now: bigint): ProcessLine {
  const canStart = o.activityTimestamp + o.inheritInactivityPeriod;
  // With a recovery started, the inheritance cannot start before its window expires (Lib l. 117-128).
  const blocked = o.recoveryStarted ? o.recoveryStartTimestamp + o.recoveryExecutionWindow : 0n;
  const steps: ProcessStep[] = [{ key: "active", title: t("process.ownerLastActive"), when: { kind: "at", at: o.activityTimestamp } }];
  if (o.inheritanceStarted) {
    const s = o.inheritanceStartTimestamp;
    steps.push(
      { key: "start", title: t("process.inheritanceStarted"), when: { kind: "at", at: s } },
      { key: "claims", title: t("process.claimsOpen"), when: { kind: "at", at: s + o.inheritWaitingTime } },
      { key: "rest", title: t("process.restAvailable"), when: { kind: "at", at: s + o.inheritWaitingTime + o.inheritRemainingWaitingTime } },
    );
  } else {
    steps.push(
      { key: "start", title: t("process.inheritanceCanStart"), when: { kind: "at", at: blocked > canStart ? blocked : canStart } },
      { key: "claims", title: t("process.claimsOpen"), when: { kind: "after-start", period: o.inheritWaitingTime, notBefore: null } },
      { key: "rest", title: t("process.restAvailable"), when: { kind: "after-start", period: o.inheritWaitingTime + o.inheritRemainingWaitingTime, notBefore: null } },
    );
  }
  return placeNow(steps, now);
}

export interface ContactLineInput {
  activityTimestamp: bigint;
  heirCount: bigint;
  recoveryStarted: boolean;
  recoveryStartTimestamp: bigint;
  recoveryInactivityPeriod: bigint;
  recoveryWaitingTime: bigint;
  recoveryExecutionWindow: bigint;
  inheritInactivityPeriod: bigint;
}

/**
 * Recovery: last activity → the recovery can start (or started) → it can be recovered → (if there are heirs)
 * the heirs can take it over: max(start + window, activity + inheritance inactivity) (Lib l. 117-128).
 */
export function contactLine(o: ContactLineInput, now: bigint): ProcessLine {
  const inherit = o.activityTimestamp + o.inheritInactivityPeriod;
  const steps: ProcessStep[] = [{ key: "active", title: t("process.ownerLastActive"), when: { kind: "at", at: o.activityTimestamp } }];
  if (o.recoveryStarted) {
    const s = o.recoveryStartTimestamp;
    const window = s + o.recoveryExecutionWindow;
    steps.push(
      { key: "start", title: t("process.recoveryStarted"), when: { kind: "at", at: s } },
      { key: "recover", title: t("process.youCanRecover"), when: { kind: "at", at: s + o.recoveryWaitingTime } },
    );
    if (o.heirCount > 0n) steps.push({ key: "takeover", title: t("process.heirsCanTakeOver"), when: { kind: "at", at: window > inherit ? window : inherit } });
  } else {
    steps.push(
      { key: "start", title: t("process.recoveryCanStart"), when: { kind: "at", at: o.activityTimestamp + o.recoveryInactivityPeriod } },
      { key: "recover", title: t("process.youCanRecover"), when: { kind: "after-start", period: o.recoveryWaitingTime, notBefore: null } },
    );
    if (o.heirCount > 0n) {
      // It would start at the earliest at activity + recovery inactivity: if with that the window already falls after the
      // inheritance inactivity, the date is only "window after the start"; if not, not before that date either.
      const earliest = o.activityTimestamp + o.recoveryInactivityPeriod + o.recoveryExecutionWindow;
      steps.push({ key: "takeover", title: t("process.heirsCanTakeOver"), when: { kind: "after-start", period: o.recoveryExecutionWindow, notBefore: earliest >= inherit ? null : inherit } });
    }
  }
  return placeNow(steps, now);
}
