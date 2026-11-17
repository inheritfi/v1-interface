// INHERITFI: format of periods and dates, and what "now" is. The contract periods are seconds and are not necessarily whole days.

import { t } from "../i18n";

const MINUTE = 60n;
const HOUR = 3_600n;
const DAY = 86_400n;

/** "15 days", "1 day 6 h", "45 min". It never rounds up. */
export function formatPeriod(seconds: bigint): string {
  if (seconds < 0n) {
    throw new Error("Invalid period");
  }
  const d = seconds / DAY;
  const h = (seconds % DAY) / HOUR;
  const m = (seconds % HOUR) / MINUTE;
  const parts: string[] = [];
  if (d > 0n) parts.push(t("time.days", { count: d }));
  if (h > 0n) parts.push(t("time.hours", { count: h }));
  if (m > 0n && d === 0n) parts.push(t("time.minutes", { count: m }));
  return parts.length > 0 ? parts.join(t("time.separator")) : t("time.seconds", { count: seconds });
}

/** Local date and time (e.g. "Oct 18, 14:05"), for periods where the hours matter. */
export function formatDateTime(seconds: bigint, locale: string, timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  if (timeZone !== undefined) {
    options.timeZone = timeZone;
  }
  return new Intl.DateTimeFormat(locale, options).format(new Date(Number(seconds) * 1000));
}

/**
 * - "block": "now" is the time of the block read. It is what mainnet uses: the periods are reached according to the time of
 *   the blocks, not according to the browser's clock, which may be wrong or manipulated.
 * - "max-block-clock": the greater of the block time and the browser's clock (for a development node whose last
 *   block may be older than the real time). Not used by the mainnet build.
 */
export type ClockMode = "block" | "max-block-clock";

/** Browser clock in seconds. It is only called in "max-block-clock" mode. */
export const readBrowserClock = (): bigint => BigInt(Math.floor(Date.now() / 1000));

/**
 * "Now" to compare with the contract periods. In "block" mode it does not call `readClock` (or anything else):
 * it returns the block time as it is.
 */
export function effectiveNow(mode: ClockMode, blockTimestamp: bigint, readClock: () => bigint): bigint {
  if (mode === "block") {
    return blockTimestamp;
  }
  const clock = readClock();
  return clock > blockTimestamp ? clock : blockTimestamp;
}
