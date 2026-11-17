import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { bpsToInput, checkAddresses, overlap, parseAddress, parsePercent, splitEvenly, validateContacts, validateHeirs } from "./heirs";

const ME = getAddress("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
const A = getAddress("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc");
const B = getAddress("0x90f79bf6eb2c4f870365e785982e1f101e93b906");
const WRAPPER = getAddress("0x7a2088a1bfc9d81c55368ae168c2c02570cb814f");
const ctx = { account: ME, protocol: [WRAPPER] };

describe("parseAddress", () => {
  it("accepts valid checksum, lowercase and uppercase; always returns with checksum", () => {
    expect(parseAddress(A)).toEqual({ ok: true, address: A });
    expect(parseAddress(A.toLowerCase())).toEqual({ ok: true, address: A });
    expect(parseAddress(`0x${A.slice(2).toUpperCase()}`)).toEqual({ ok: true, address: A });
    expect(parseAddress(`  ${A}  `)).toEqual({ ok: true, address: A });
  });

  it("rejects empty, format, invalid checksum and the zero address", () => {
    expect(parseAddress("")).toEqual({ ok: false, reason: "empty" });
    expect(parseAddress("0x123")).toEqual({ ok: false, reason: "format" });
    expect(parseAddress(`${A}0`)).toEqual({ ok: false, reason: "format" });
    expect(parseAddress(A.slice(2))).toEqual({ ok: false, reason: "format" });
    // Same text with one letter in another case: invalid EIP-55 checksum.
    const i = A.search(/[a-f]/);
    const bad = `${A.slice(0, i)}${A.charAt(i).toUpperCase()}${A.slice(i + 1)}`;
    expect(parseAddress(bad)).toEqual({ ok: false, reason: "checksum" });
    expect(parseAddress(`0x${"0".repeat(40)}`)).toEqual({ ok: false, reason: "zero" });
  });
});

describe("checkAddresses", () => {
  it("rejects the owner, the protocol contracts and repeats (case-insensitive)", () => {
    const r = checkAddresses([ME.toLowerCase(), WRAPPER.toLowerCase(), A, A.toLowerCase(), B], ctx);
    expect(r.map((x) => (x.ok ? "ok" : x.reason))).toEqual(["self", "protocol", "ok", "duplicate", "ok"]);
  });
});

describe("parsePercent y bpsToInput", () => {
  it("converts to basis points with up to 2 decimals", () => {
    expect(parsePercent("100")).toEqual({ ok: true, bps: 10_000n });
    expect(parsePercent("33.34")).toEqual({ ok: true, bps: 3_334n });
    expect(parsePercent("0.01")).toEqual({ ok: true, bps: 1n });
    expect(parsePercent("5.5")).toEqual({ ok: true, bps: 550n });
    expect(bpsToInput(3_334n)).toBe("33.34");
    expect(bpsToInput(1n)).toBe("0.01");
    expect(bpsToInput(10_000n)).toBe("100.00");
  });

  it("rejects empty, 0, more than 100, more than 2 decimals and other formats", () => {
    for (const s of ["", "0", "0.00", "100.01", "1.234", "-1", "1e2", ".5", "1,5", "abc"]) {
      expect(parsePercent(s).ok).toBe(false);
    }
  });
});

describe("splitEvenly", () => {
  it("sums exactly 10 000 and the remainder goes to the first", () => {
    expect(splitEvenly(1)).toEqual([10_000n]);
    expect(splitEvenly(3)).toEqual([3_334n, 3_333n, 3_333n]);
    expect(splitEvenly(7)).toEqual([1_432n, 1_428n, 1_428n, 1_428n, 1_428n, 1_428n, 1_428n]);
    for (let n = 1; n <= 50; n++) expect(splitEvenly(n).reduce((a, b) => a + b, 0n)).toBe(10_000n);
    expect(() => splitEvenly(0)).toThrow();
  });
});

describe("validateHeirs", () => {
  it("valid list: addresses with checksum and basis points", () => {
    const v = validateHeirs(
      [
        { address: A.toLowerCase(), percent: "60" },
        { address: B, percent: "40" },
      ],
      ctx,
      15n,
    );
    expect(v.total).toBe(10_000n);
    expect(v.result).toEqual({ ok: true, value: { wallets: [A, B], bps: [6_000n, 4_000n] } });
  });

  it("rejects empty list, more than maxHeirs, rows with errors and a sum different from 100 %", () => {
    expect(validateHeirs([], ctx, 15n).result.ok).toBe(false);
    const sixteen = Array.from({ length: 16 }, (_, i) => ({ address: getAddress(`0x${(i + 1).toString(16).padStart(40, "0")}`), percent: "1" }));
    expect(validateHeirs(sixteen, ctx, 15n).result).toEqual({ ok: false, reason: "The protocol allows at most 15 heirs." });
    expect(validateHeirs([{ address: ME, percent: "100" }], ctx, 15n).result.ok).toBe(false);
    const short = validateHeirs(
      [
        { address: A, percent: "60" },
        { address: B, percent: "39.99" },
      ],
      ctx,
      15n,
    );
    expect(short.total).toBe(9_999n);
    expect(short.result).toEqual({ ok: false, reason: "The shares must add up to exactly 100.00%." });
  });
});

describe("validateContacts", () => {
  it("1..maxRecoveryUsers valid addresses", () => {
    expect(validateContacts([A, B.toLowerCase()], ctx, 10n).result).toEqual({ ok: true, value: [A, B] });
    expect(validateContacts([], ctx, 10n).result.ok).toBe(false);
    const eleven = Array.from({ length: 11 }, (_, i) => getAddress(`0x${(i + 1).toString(16).padStart(40, "0")}`));
    expect(validateContacts(eleven, ctx, 10n).result).toEqual({ ok: false, reason: "The protocol allows at most 10 recovery contacts." });
    expect(validateContacts([A, WRAPPER], ctx, 10n).result.ok).toBe(false);
  });
});

describe("overlap", () => {
  it("finds the addresses that are in both lists", () => {
    expect(overlap([A, B], [B.toLowerCase()])).toEqual([B]);
    expect(overlap([A], [B])).toEqual([]);
  });
});
