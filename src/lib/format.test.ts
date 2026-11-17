import { describe, expect, it } from "vitest";
import {
  formatExact,
  ZERO_ADDRESS,
  formatBasisPoints,
  formatUnits,
  isAddress,
  isZeroAddress,
  parseUnits,
  shortAddress,
} from "./format";

describe("formatUnits", () => {
  it("formats 18-decimal amounts exactly", () => {
    expect(formatUnits(12_480_000_000_000_000_000n, 18, 6)).toBe("12.480000");
    expect(formatUnits(1n, 18, 18)).toBe("0.000000000000000001");
  });

  it("truncates and never rounds up", () => {
    expect(formatUnits(1_999_999_999_999_999_999n, 18, 2)).toBe("1.99");
  });

  it("supports 8 decimals (WBTC) and thousands separators", () => {
    expect(formatUnits(123_456_789_012_345n, 8, 8)).toBe("1,234,567.89012345");
  });

  it("handles zero, whole-only output and amounts beyond Number precision", () => {
    expect(formatUnits(0n, 18, 6)).toBe("0.000000");
    expect(formatUnits(5_000_000_000_000_000_000n, 18, 0)).toBe("5");
    expect(formatUnits(2n ** 128n, 18, 0)).toBe("340,282,366,920,938,463,463");
  });

  it("rejects invalid parameters", () => {
    expect(() => formatUnits(1n, 18, 19)).toThrow();
    expect(() => formatUnits(1n, -1, 0)).toThrow();
    expect(() => formatUnits(1n, 18, 1.5)).toThrow();
  });
});

describe("parseUnits", () => {
  it("parses user input into base units exactly", () => {
    expect(parseUnits("250.00", 18)).toEqual({ ok: true, value: 250_000_000_000_000_000_000n });
    expect(parseUnits("0.00000001", 8)).toEqual({ ok: true, value: 1n });
    expect(parseUnits(".5", 18)).toEqual({ ok: true, value: 500_000_000_000_000_000n });
    expect(parseUnits(" 7 ", 18)).toEqual({ ok: true, value: 7_000_000_000_000_000_000n });
  });

  it("rejects anything that is not plain digits", () => {
    for (const bad of ["1e18", "-1", "+1", "1,000", "0x10", "1.2.3", ".", "abc", "١٢٣"]) {
      expect(parseUnits(bad, 18).ok, bad).toBe(false);
    }
    expect(parseUnits("", 18)).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects more decimals than the token supports", () => {
    expect(parseUnits("0.000000001", 8)).toEqual({ ok: false, reason: "precision" });
  });

  it("round-trips with formatUnits", () => {
    const parsed = parseUnits("1234.56789012", 8);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(formatUnits(parsed.value, 8, 8)).toBe("1,234.56789012");
    }
  });
});

describe("addresses", () => {
  const address = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE";

  it("validates format", () => {
    expect(isAddress(address)).toBe(true);
    expect(isAddress("0x123")).toBe(false);
    expect(isAddress(`${address} `)).toBe(false);
  });

  it("detects the zero address in any case", () => {
    expect(isZeroAddress(ZERO_ADDRESS)).toBe(true);
    expect(isZeroAddress(address)).toBe(false);
  });

  it("shortens to prefix and last four characters", () => {
    expect(shortAddress(address)).toBe("0x3f5C…f0bE");
    expect(() => shortAddress("0x123")).toThrow();
  });
});

describe("formatBasisPoints", () => {
  it("formats protocol fees", () => {
    expect(formatBasisPoints(30n)).toBe("0.3%");
    expect(formatBasisPoints(25n)).toBe("0.25%");
    expect(formatBasisPoints(6_000n)).toBe("60%");
    expect(formatBasisPoints(0n)).toBe("0%");
  });
});

describe("formatExact", () => {
  it("all the decimals, without separators, and parseUnits reads it back exactly", () => {
    expect(formatExact(1_500_000n, 6)).toBe("1.5");
    expect(formatExact(0n, 18)).toBe("0");
    expect(formatExact(1n, 18)).toBe("0.000000000000000001");
    expect(formatExact(1234567n * 10n ** 18n, 18)).toBe("1234567");
    for (const [v, d] of [[123_456_789_012_345_678_901n, 18], [99_999_999n, 8], [7n, 0]] as const) {
      expect(parseUnits(formatExact(v, d), d)).toEqual({ ok: true, value: v });
    }
    expect(() => formatExact(-1n, 18)).toThrow();
  });
});
