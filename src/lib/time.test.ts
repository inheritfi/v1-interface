import { describe, expect, it } from "vitest";
import { CLOCK_MODE, POLL_MS } from "../web3/network";
import { effectiveNow, formatDateTime, formatPeriod } from "./time";

describe("formatPeriod", () => {
  it("days, hours and minutes without rounding up", () => {
    expect(formatPeriod(15n * 86_400n)).toBe("15 days");
    expect(formatPeriod(86_400n)).toBe("1 day");
    expect(formatPeriod(86_400n + 6n * 3_600n + 59n * 60n)).toBe("1 day 6 h");
    expect(formatPeriod(45n * 60n + 59n)).toBe("45 min");
    expect(formatPeriod(59n)).toBe("59 s");
    expect(() => formatPeriod(-1n)).toThrow();
  });
});

describe("formatDateTime", () => {
  it("shows date and time in 24 h", () => {
    expect(formatDateTime(1_790_000_000n, "en-US", "UTC")).toBe("Sep 21, 14:13");
  });
});

describe("effectiveNow", () => {
  const forbidden = (): bigint => {
    throw new Error("the browser clock must not be read in block mode");
  };

  it('"block" mode: returns the block time and never queries the clock', () => {
    expect(effectiveNow("block", 100n, forbidden)).toBe(100n);
    expect(effectiveNow("block", 0n, forbidden)).toBe(0n);
  });

  it('"max-block-clock" mode: the greater of block and clock', () => {
    expect(effectiveNow("max-block-clock", 100n, () => 200n)).toBe(200n);
    expect(effectiveNow("max-block-clock", 300n, () => 200n)).toBe(300n);
  });

  it("mainnet uses only the block time and reads every 12 s", () => {
    expect(CLOCK_MODE).toEqual({ mainnet: "block" });
    expect(POLL_MS).toEqual({ mainnet: 12_000 });
  });
});
