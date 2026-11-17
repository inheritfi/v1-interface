// INHERITFI: calculation of the succession line of a plan (one wrapper).
// All the times are Unix seconds as bigint, the same as in the contract.

export const SECONDS_PER_DAY = 86_400n;

export type SuccessionPhase = "active" | "recovery-open" | "inheritance-open";

export interface SuccessionInput {
  /** Last moment with proof of life of the owner (Unix seconds). */
  lastActivity: bigint;
  /** Inactivity period after which the recovery contacts can act (seconds). */
  recoveryPeriod: bigint;
  /** Inactivity period after which the heirs can start the inheritance (seconds). */
  inheritancePeriod: bigint;
  /** Current moment (Unix seconds); it is passed explicitly so that the calculation can be checked. */
  now: bigint;
}

export interface Succession {
  phase: SuccessionPhase;
  /** Full days elapsed without activity (never negative). */
  inactiveDays: bigint;
  recoveryDays: bigint;
  inheritanceDays: bigint;
  /** Full days remaining until the inheritance opens (0 if it already opened). */
  daysUntilInheritance: bigint;
  recoveryOpensAt: bigint;
  inheritanceOpensAt: bigint;
}

export function computeSuccession(input: SuccessionInput): Succession {
  const { lastActivity, recoveryPeriod, inheritancePeriod, now } = input;
  if (recoveryPeriod <= 0n || inheritancePeriod <= 0n) {
    throw new Error("Periods must be positive");
  }
  // The contract guarantees recovery < inheritance; if it does not hold, the data is not reliable.
  if (recoveryPeriod >= inheritancePeriod) {
    throw new Error("Recovery period must be shorter than inheritance period");
  }
  const elapsed = now > lastActivity ? now - lastActivity : 0n;
  const recoveryOpensAt = lastActivity + recoveryPeriod;
  const inheritanceOpensAt = lastActivity + inheritancePeriod;
  let phase: SuccessionPhase = "active";
  if (elapsed >= inheritancePeriod) {
    phase = "inheritance-open";
  } else if (elapsed >= recoveryPeriod) {
    phase = "recovery-open";
  }
  const remaining = inheritancePeriod > elapsed ? inheritancePeriod - elapsed : 0n;
  return {
    phase,
    inactiveDays: elapsed / SECONDS_PER_DAY,
    recoveryDays: recoveryPeriod / SECONDS_PER_DAY,
    inheritanceDays: inheritancePeriod / SECONDS_PER_DAY,
    daysUntilInheritance: remaining / SECONDS_PER_DAY,
    recoveryOpensAt,
    inheritanceOpensAt,
  };
}

/** Position (0 to 1) of an instant within the line, which goes from lastActivity to inheritanceOpensAt. */
export function linePosition(at: bigint, lastActivity: bigint, inheritancePeriod: bigint): number {
  if (inheritancePeriod <= 0n) {
    throw new Error("Invalid period");
  }
  const offset = at > lastActivity ? at - lastActivity : 0n;
  const clamped = offset > inheritancePeriod ? inheritancePeriod : offset;
  // Precision of 1/10000: enough to draw and without converting the seconds to number.
  return Number((clamped * 10_000n) / inheritancePeriod) / 10_000;
}

export function formatDate(seconds: bigint, locale: string, timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (timeZone !== undefined) {
    options.timeZone = timeZone;
  }
  return new Intl.DateTimeFormat(locale, options).format(new Date(Number(seconds) * 1000));
}
