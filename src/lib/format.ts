// INHERITFI: exact format of amounts and addresses.
// On-chain amounts are integers (bigint); they are never converted to number so as not to lose precision.

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value);
}

export function isZeroAddress(value: string): boolean {
  return value.toLowerCase() === ZERO_ADDRESS;
}

/** 0x3f5C…a91E: keeps the prefix and the last 4 characters. */
export function shortAddress(address: string): string {
  if (!isAddress(address)) {
    throw new Error("Invalid address");
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Invalid decimals");
  }
}

/**
 * Converts minimum units to exact decimal text, truncating (never rounds up)
 * to `fractionDigits` decimals and with a thousands separator.
 * Example: formatUnits(12480000000000000000n, 18, 6) === "12.480000".
 */
export function formatUnits(value: bigint, decimals: number, fractionDigits: number): string {
  assertDecimals(decimals);
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > decimals) {
    throw new Error("Invalid fraction digits");
  }
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, "0").slice(0, fractionDigits);
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const text = fractionDigits > 0 ? `${wholeText}.${fraction}` : wholeText;
  return negative ? `-${text}` : text;
}

/**
 * All the decimals, without separators or extra zeros, to fill an amount field: parseUnits reads it
 * back exactly (formatExact(1500000n, 6) === "1.5").
 */
export function formatExact(value: bigint, decimals: number): string {
  assertDecimals(decimals);
  if (value < 0n) {
    throw new Error("Negative amount");
  }
  const base = 10n ** BigInt(decimals);
  const whole = (value / base).toString();
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction === "" ? whole : `${whole}.${fraction}`;
}

export type ParseResult = { ok: true; value: bigint } | { ok: false; reason: "empty" | "format" | "precision" };

/**
 * Converts what the user types to minimum units. It only accepts digits and a decimal point
 * (no signs, exponents or separators) and rejects more decimals than the token admits.
 */
export function parseUnits(input: string, decimals: number): ParseResult {
  assertDecimals(decimals);
  const text = input.trim();
  if (text === "") {
    return { ok: false, reason: "empty" };
  }
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (match === null) {
    return { ok: false, reason: "format" };
  }
  const whole = match[1] ?? "";
  const fraction = match[2] ?? "";
  if (whole === "" && fraction === "") {
    return { ok: false, reason: "format" };
  }
  if (fraction.length > decimals) {
    return { ok: false, reason: "precision" };
  }
  const digits = `${whole === "" ? "0" : whole}${fraction.padEnd(decimals, "0")}`;
  return { ok: true, value: BigInt(digits) };
}

/** Percentage in basis points (10000 = 100 %) with at most 2 decimals, without extra zeros. */
export function formatBasisPoints(bps: bigint): string {
  if (bps < 0n) {
    throw new Error("Invalid basis points");
  }
  const whole = bps / 100n;
  const fraction = (bps % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return fraction === "" ? `${whole.toString()}%` : `${whole.toString()}.${fraction}%`;
}
