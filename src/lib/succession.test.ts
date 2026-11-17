import { describe, expect, it } from "vitest";
import { SECONDS_PER_DAY, computeSuccession, formatDate, linePosition } from "./succession";

const day = SECONDS_PER_DAY;
const lastActivity = 1_788_048_000n; // 2026-08-30 00:00:00 UTC
const base = { lastActivity, recoveryPeriod: 90n * day, inheritancePeriod: 180n * day };

describe("computeSuccession", () => {
  it("is active before the recovery period ends", () => {
    const s = computeSuccession({ ...base, now: lastActivity + 41n * day + 3_600n });
    expect(s.phase).toBe("active");
    expect(s.inactiveDays).toBe(41n);
    expect(s.daysUntilInheritance).toBe(138n);
  });

  it("opens recovery exactly at the recovery period", () => {
    expect(computeSuccession({ ...base, now: lastActivity + 90n * day - 1n }).phase).toBe("active");
    expect(computeSuccession({ ...base, now: lastActivity + 90n * day }).phase).toBe("recovery-open");
  });

  it("opens inheritance exactly at the inheritance period", () => {
    expect(computeSuccession({ ...base, now: lastActivity + 180n * day - 1n }).phase).toBe("recovery-open");
    const s = computeSuccession({ ...base, now: lastActivity + 180n * day });
    expect(s.phase).toBe("inheritance-open");
    expect(s.daysUntilInheritance).toBe(0n);
  });

  it("never reports negative time if the clock is behind the chain", () => {
    const s = computeSuccession({ ...base, now: lastActivity - 100n });
    expect(s.inactiveDays).toBe(0n);
    expect(s.phase).toBe("active");
  });

  it("rejects data that breaks the contract rule recovery < inheritance", () => {
    expect(() => computeSuccession({ ...base, recoveryPeriod: 180n * day, now: lastActivity })).toThrow();
    expect(() => computeSuccession({ ...base, recoveryPeriod: 0n, now: lastActivity })).toThrow();
  });
});

describe("linePosition", () => {
  it("places points along the line and clamps the ends", () => {
    expect(linePosition(lastActivity, lastActivity, 180n * day)).toBe(0);
    expect(linePosition(lastActivity + 90n * day, lastActivity, 180n * day)).toBe(0.5);
    expect(linePosition(lastActivity + 400n * day, lastActivity, 180n * day)).toBe(1);
    expect(linePosition(lastActivity - day, lastActivity, 180n * day)).toBe(0);
  });
});

describe("formatDate", () => {
  it("formats with an explicit time zone", () => {
    expect(formatDate(lastActivity, "en", "UTC")).toBe("Aug 30");
    expect(formatDate(lastActivity + 180n * day, "en", "UTC")).toBe("Feb 26");
  });
});
