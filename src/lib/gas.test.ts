import { describe, expect, it } from "vitest";
import { ethMaxAfterReserve, withGasMargin } from "./gas";

describe("withGasMargin", () => {
  it("+25 % rounded up; covers the measured case (35 045 estimated, 37 845 used)", () => {
    expect(withGasMargin(35_045n)).toBe(43_807n);
    expect(withGasMargin(35_045n) > 37_845n).toBe(true);
    expect(withGasMargin(4n)).toBe(5n);
    expect(withGasMargin(1n)).toBe(2n);
    expect(() => withGasMargin(0n)).toThrow();
  });
});

describe("ethMaxAfterReserve", () => {
  it("reserve = gas limit × max price × 2; Max = balance − reserve", () => {
    expect(ethMaxAfterReserve(10n ** 18n, 50_000n, 2_000_000_000n)).toEqual({ amount: 10n ** 18n - 200_000_000_000_000n, reserve: 200_000_000_000_000n });
  });
  it("without enough balance for the reserve: null (also if exactly 0 remains)", () => {
    expect(ethMaxAfterReserve(200_000_000_000_000n, 50_000n, 2_000_000_000n)).toBeNull();
    expect(ethMaxAfterReserve(1n, 50_000n, 2_000_000_000n)).toBeNull();
    expect(ethMaxAfterReserve(0n, 50_000n, 2_000_000_000n)).toBeNull();
  });
  it("invalid inputs: throws", () => {
    expect(() => ethMaxAfterReserve(-1n, 1n, 1n)).toThrow();
    expect(() => ethMaxAfterReserve(1n, 0n, 1n)).toThrow();
    expect(() => ethMaxAfterReserve(1n, 1n, 0n)).toThrow();
  });
});
