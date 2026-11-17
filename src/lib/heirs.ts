/**
 * INHERITFI: validation of heirs and recovery contacts in the browser, with the same rules as the
 * contract (InheritfiV1InheritanceLib.setHeirs and setRecoveryUsers, SHA-256 f0443a76…) plus three of the interface:
 *   - addresses: they are accepted in lowercase (or uppercase); if they mix uppercase and lowercase, the EIP-55 checksum must
 *     be valid; they are always returned with checksum;
 *   - the addresses of the protocol contracts are blocked (wrappers, underlyings, libraries, Multicall3);
 *   - "Split evenly": split in basis points with the remainder for the first heir.
 * Contract: setHeirs requires 1..maxHeirs, no zero, not the owner, no repeats, each percentage in (0, 10000] and an exact
 * sum of 10000; setRecoveryUsers requires 1..maxRecoveryUsers, no zero, not the owner, no repeats.
 */
import { getAddress } from "viem";
import { BP } from "./fees";
import { t, type MessageKey } from "../i18n";

export type Hex40 = `0x${string}`;

export type AddressCheck =
  | { ok: true; address: Hex40 }
  | { ok: false; reason: "empty" | "format" | "checksum" | "zero" | "self" | "protocol" | "duplicate" };

const ADDRESS_ERROR_KEYS: Record<Exclude<AddressCheck, { ok: true }>["reason"], MessageKey> = {
  empty: "address.empty",
  format: "address.format",
  checksum: "address.checksum",
  zero: "address.zero",
  self: "address.self",
  protocol: "address.protocol",
  duplicate: "address.duplicate",
};

/** Text of the reason why an address is not valid, in the current language. */
export function addressErrorText(reason: Exclude<AddressCheck, { ok: true }>["reason"]): string {
  return t(ADDRESS_ERROR_KEYS[reason]);
}

/** Shape of the address (without list rules). */
export function parseAddress(input: string): AddressCheck {
  const s = input.trim();
  if (s === "") return { ok: false, reason: "empty" };
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return { ok: false, reason: "format" };
  const body = s.slice(2);
  const checksummed = getAddress(s);
  const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
  if (mixed && checksummed !== s) return { ok: false, reason: "checksum" };
  if (/^0x0{40}$/.test(s)) return { ok: false, reason: "zero" };
  return { ok: true, address: checksummed };
}

export type PctCheck = { ok: true; bps: bigint } | { ok: false; reason: string };

/** Percentage with up to 2 decimals (1 basis point = 0.01 %), greater than 0 and at most 100. */
export function parsePercent(input: string): PctCheck {
  const s = input.trim();
  if (s === "") return { ok: false, reason: t("pct.empty") };
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(s);
  if (m === null) return { ok: false, reason: t("pct.format") };
  const bps = BigInt(m[1] ?? "0") * 100n + BigInt((m[2] ?? "").padEnd(2, "0"));
  if (bps === 0n) return { ok: false, reason: t("pct.zero") };
  if (bps > BP) return { ok: false, reason: t("pct.tooBig") };
  return { ok: true, bps };
}

/** Basis points as editable text (always 2 decimals), e.g. 3334n → "33.34". */
export function bpsToInput(bps: bigint): string {
  return `${(bps / 100n).toString()}.${(bps % 100n).toString().padStart(2, "0")}`;
}

/** Equal split of 100 % in basis points; the remainder of the division goes to the first. */
export function splitEvenly(n: number): bigint[] {
  if (!Number.isInteger(n) || n < 1) throw new Error("Need at least one heir");
  const each = BP / BigInt(n);
  const rest = BP - each * BigInt(n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? each + rest : each));
}

export interface ListContext {
  account: Hex40;
  /** Addresses of the protocol contracts (from the verified manifest), in any format. */
  protocol: readonly string[];
}

/** Validates each address of a list: shape, zero, owner, protocol contracts and repeats. */
export function checkAddresses(inputs: readonly string[], ctx: ListContext): AddressCheck[] {
  const protocol = new Set(ctx.protocol.map((a) => a.toLowerCase()));
  const seen = new Set<string>();
  return inputs.map((input) => {
    const r = parseAddress(input);
    if (!r.ok) return r;
    const low = r.address.toLowerCase();
    if (low === ctx.account.toLowerCase()) return { ok: false, reason: "self" };
    if (protocol.has(low)) return { ok: false, reason: "protocol" };
    if (seen.has(low)) return { ok: false, reason: "duplicate" };
    seen.add(low);
    return r;
  });
}

export interface HeirRow {
  address: string;
  percent: string;
}

export type ListResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export function validateHeirs(
  rows: readonly HeirRow[],
  ctx: ListContext,
  maxHeirs: bigint,
): { addresses: AddressCheck[]; percents: PctCheck[]; total: bigint; result: ListResult<{ wallets: Hex40[]; bps: bigint[] }> } {
  const addresses = checkAddresses(
    rows.map((r) => r.address),
    ctx,
  );
  const percents = rows.map((r) => parsePercent(r.percent));
  const total = percents.reduce((acc, p) => acc + (p.ok ? p.bps : 0n), 0n);
  let result: ListResult<{ wallets: Hex40[]; bps: bigint[] }>;
  if (rows.length === 0) result = { ok: false, reason: t("heirs.atLeastOne") };
  else if (BigInt(rows.length) > maxHeirs) result = { ok: false, reason: t("heirs.tooMany", { max: maxHeirs }) };
  else if (addresses.some((a) => !a.ok) || percents.some((p) => !p.ok)) result = { ok: false, reason: t("list.fixRows") };
  else if (total !== BP) result = { ok: false, reason: t("heirs.total") };
  else {
    result = {
      ok: true,
      value: {
        wallets: addresses.map((a) => (a.ok ? a.address : "0x")),
        bps: percents.map((p) => (p.ok ? p.bps : 0n)),
      },
    };
  }
  return { addresses, percents, total, result };
}

export function validateContacts(
  inputs: readonly string[],
  ctx: ListContext,
  maxRecoveryUsers: bigint,
): { addresses: AddressCheck[]; result: ListResult<Hex40[]> } {
  const addresses = checkAddresses(inputs, ctx);
  let result: ListResult<Hex40[]>;
  if (inputs.length === 0) result = { ok: false, reason: t("contacts.atLeastOne") };
  else if (BigInt(inputs.length) > maxRecoveryUsers) result = { ok: false, reason: t("contacts.tooMany", { max: maxRecoveryUsers }) };
  else if (addresses.some((a) => !a.ok)) result = { ok: false, reason: t("list.fixRows") };
  else result = { ok: true, value: addresses.map((a) => (a.ok ? a.address : "0x")) };
  return { addresses, result };
}

/** Addresses that are in both lists at the same time (for the warning; the contract allows it). */
export function overlap(a: readonly string[], b: readonly string[]): Hex40[] {
  const other = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => other.has(x.toLowerCase())).map((x) => getAddress(x));
}
