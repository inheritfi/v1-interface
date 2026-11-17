import { describe, expect, it } from "vitest";
import { splitFee } from "./fees";

describe("splitFee (the same as the contract's _taxSplit)", () => {
  it("0.3 % truncates down and net + fee = amount", () => {
    expect(splitFee(10n ** 18n, 30n)).toEqual({ fee: 3n * 10n ** 15n, net: 997n * 10n ** 15n });
    expect(splitFee(333n, 30n)).toEqual({ fee: 0n, net: 333n });
    expect(splitFee(334n, 30n)).toEqual({ fee: 1n, net: 333n });
    for (const a of [0n, 1n, 999n, 123_456_789_123_456_789n]) {
      const s = splitFee(a, 30n);
      expect(s.fee + s.net).toBe(a);
    }
  });

  it("no fee and limits", () => {
    expect(splitFee(5n, 0n)).toEqual({ fee: 0n, net: 5n });
    expect(splitFee(5n, 10_000n)).toEqual({ fee: 5n, net: 0n });
    expect(() => splitFee(-1n, 30n)).toThrow();
    expect(() => splitFee(1n, 10_001n)).toThrow();
    expect(() => splitFee(1n, -1n)).toThrow();
  });
});
