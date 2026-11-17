import { describe, expect, it } from "vitest";
import { approveReturnOk, expectedAllowanceAfter, planWrapSteps } from "./approval";

describe("planWrapSteps (exact approval)", () => {
  it("equal to the amount: only wrap", () => {
    expect(planWrapSteps(5n, 5n)).toEqual(["wrap"]);
  });

  it("at 0: approve and wrap", () => {
    expect(planWrapSteps(0n, 5n)).toEqual(["approve", "wrap"]);
  });

  it("lower or higher than the amount: first to 0, then the exact amount and wrap", () => {
    expect(planWrapSteps(4n, 5n)).toEqual(["reset", "approve", "wrap"]);
    expect(planWrapSteps(6n, 5n)).toEqual(["reset", "approve", "wrap"]);
    expect(planWrapSteps(2n ** 256n - 1n, 5n)).toEqual(["reset", "approve", "wrap"]);
  });

  it("rejects a non-positive amount or a negative approval", () => {
    expect(() => planWrapSteps(0n, 0n)).toThrow();
    expect(() => planWrapSteps(-1n, 5n)).toThrow();
  });

  it("expected approval after each step", () => {
    expect(expectedAllowanceAfter("reset", 5n)).toBe(0n);
    expect(expectedAllowanceAfter("approve", 5n)).toBe(5n);
  });
});

describe("approveReturnOk", () => {
  it("accepts empty or true; rejects false and anything else", () => {
    expect(approveReturnOk(undefined)).toBe(true);
    expect(approveReturnOk("0x")).toBe(true);
    expect(approveReturnOk(`0x${"0".repeat(63)}1`)).toBe(true);
    expect(approveReturnOk(`0x${"0".repeat(64)}`)).toBe(false);
    expect(approveReturnOk(`0x${"0".repeat(63)}2`)).toBe(false);
    expect(approveReturnOk("0x01")).toBe(false);
  });
});
