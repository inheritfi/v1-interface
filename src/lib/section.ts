import { parseAddress, type Hex40 } from "./heirs";

/** Section of the menu according to the URL. null: there is no section (the entry screen is decided according to the account). */
export type Section = "plan" | "wrap" | "heir" | "contact";

export const SECTION_HASH: Readonly<Record<Section, string>> = { plan: "#plan", wrap: "#wrap", heir: "#heir", contact: "#contact" };

/** Prefix of the link that the owner shares with their heirs and contacts: #owner/0x…. */
export const OWNER_LINK_PREFIX = "#owner/";

export function ownerLinkHash(owner: Hex40): string {
  return `${OWNER_LINK_PREFIX}${owner}`;
}

/**
 * View of the recovery contact for an owner: #contact/0x…. The
 * link that is shared is still #owner/0x…: it opens the view of the role that the account has.
 */
export const CONTACT_LINK_PREFIX = "#contact/";

export function contactLinkHash(owner: Hex40): string {
  return `${CONTACT_LINK_PREFIX}${owner}`;
}

/** Address of the owner in #owner/0x… or #contact/0x…; "invalid" if it does not carry a valid address. */
export function ownerFromHash(hash: string): Hex40 | "invalid" | null {
  const prefix = [OWNER_LINK_PREFIX, CONTACT_LINK_PREFIX].find((x) => hash.startsWith(x));
  if (prefix === undefined) return null;
  const a = parseAddress(hash.slice(prefix.length));
  return a.ok ? a.address : "invalid";
}

export function sectionFromHash(hash: string): Section | null {
  if (hash === SECTION_HASH.wrap) return "wrap";
  if (hash === SECTION_HASH.plan) return "plan";
  if (hash === SECTION_HASH.heir || hash.startsWith(OWNER_LINK_PREFIX)) return "heir";
  if (hash === SECTION_HASH.contact || hash.startsWith(CONTACT_LINK_PREFIX)) return "contact";
  return null;
}

/**
 * Entry screen according to the account: with some iToken or some plan
 * (heirs or contacts) in any asset → the plan; if not, wrap.
 */
export function entrySection(overview: readonly { balance: bigint; hasPlan: boolean }[]): Section {
  return overview.some((o) => o.balance > 0n || o.hasPlan) ? "plan" : "wrap";
}
