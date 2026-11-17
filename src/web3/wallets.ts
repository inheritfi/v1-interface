import coinbaseLogo from "./logos/coinbase-wallet.svg";
import metamaskLogo from "./logos/metamask.svg";
import phantomLogo from "./logos/phantom.svg";
import rabbyLogo from "./logos/rabby.svg";

/**
 * The wallets of the connect dialog .
 *
 * - Four fixed browser wallets, always listed with our own logo (an extension that is not installed announces
 *   nothing, and an announced icon proves nothing). Not installed: the dialog offers the official download page.
 *   No wallet SDK is used (no WalletConnect, no MetaMask or Coinbase SDK).
 * - "Other wallets": any other extension that announces itself (EIP-6963), shown with the name and icon it sends.
 *   Those are untrusted data: the name is cleaned and shortened, the icon is accepted only as a data: image (shown
 *   with <img>, which never runs code). An extension that uses the name of one of ours is blocked.
 * - An identifier declared by two extensions is blocked: the interface cannot tell them apart (wagmi keeps one).
 *
 * rdns: io.metamask, com.coinbase.wallet, io.rabby and app.phantom, each with that same name, checked on
 * 2026-11-13 in their own browser with the extensions installed (io.rabby is also in Rabby's documentation).
 * io.metamask.mobile (MetaMask's in-app browser) comes from the connectors of wagmi; not yet tested on a phone.
 * Download pages checked on 2026-11-13.
 */
export interface SupportedWallet {
  readonly name: string;
  readonly rdns: readonly string[];
  readonly logo: string;
  readonly installUrl: string;
}

export const SUPPORTED_WALLETS: readonly SupportedWallet[] = [
  { name: "MetaMask", rdns: ["io.metamask", "io.metamask.mobile"], logo: metamaskLogo, installUrl: "https://metamask.com/download" },
  { name: "Coinbase Wallet", rdns: ["com.coinbase.wallet"], logo: coinbaseLogo, installUrl: "https://www.coinbase.com/wallet/downloads" },
  { name: "Rabby Wallet", rdns: ["io.rabby"], logo: rabbyLogo, installUrl: "https://rabby.io/" },
  { name: "Phantom", rdns: ["app.phantom"], logo: phantomLogo, installUrl: "https://phantom.com/download" },
];

/** Names that no extension under "Other wallets" may use (compared after `nameKey`). */
const PROTECTED = ["metamask", "coinbase", "rabby", "phantom"];

/** What an extension announced (EIP-6963 `info`), as received. */
export interface Announced {
  readonly uuid: string;
  readonly rdns: string;
  readonly name: string;
  readonly icon: string;
}

export interface FixedRow<C> {
  readonly wallet: SupportedWallet;
  /** The connector of the installed extension; undefined when it is not installed. */
  readonly connector: C | undefined;
  /** More than one extension declares this wallet's identifier: it is blocked. */
  readonly duplicated: boolean;
}

export type OtherState = "ok" | "imitation" | "duplicate";

export interface OtherRow<C> {
  readonly key: string;
  readonly name: string;
  /** The announced icon if it is an accepted data: image; null otherwise (an initial is shown). */
  readonly icon: string | null;
  readonly connector: C | undefined;
  readonly state: OtherState;
}

const ALL_SUPPORTED_RDNS = new Set(SUPPORTED_WALLETS.flatMap((w) => w.rdns));

interface WithId {
  readonly id: string;
}

export function fixedRows<C extends WithId>(connectors: readonly C[], announced: readonly Announced[]): readonly FixedRow<C>[] {
  return SUPPORTED_WALLETS.map((wallet) => ({
    wallet,
    connector: connectors.find((c) => wallet.rdns.includes(c.id)),
    duplicated: announced.filter((a) => wallet.rdns.includes(a.rdns)).length > 1,
  }));
}

export function otherRows<C extends WithId>(connectors: readonly C[], announced: readonly Announced[]): readonly OtherRow<C>[] {
  return announced
    .filter((a) => !ALL_SUPPORTED_RDNS.has(a.rdns))
    .map((a) => ({
      key: a.uuid,
      name: cleanName(a.name) || cleanName(a.rdns),
      icon: cleanIcon(a.icon),
      connector: connectors.find((c) => c.id === a.rdns),
      state:
        announced.filter((b) => b.rdns === a.rdns).length > 1 ? "duplicate" : imitates(a.name) ? "imitation" : "ok",
    }));
}

/** The connectors that may be connected or reconnected: every row that is installed and not blocked. */
export function usableConnectors<C extends WithId>(connectors: readonly C[], announced: readonly Announced[]): readonly C[] {
  const fixed = fixedRows(connectors, announced).flatMap((r) => (r.connector !== undefined && !r.duplicated ? [r.connector] : []));
  const others = otherRows(connectors, announced).flatMap((r) => (r.connector !== undefined && r.state === "ok" ? [r.connector] : []));
  return [...fixed, ...others];
}

const MAX_NAME = 32;

/** Name as shown: no control, bidirectional or zero-width characters, single spaces, at most 32 characters. */
export function cleanName(name: string): string {
  const flat = name.replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/gu, " ").trim();
  const chars = Array.from(flat);
  return chars.length > MAX_NAME ? `${chars.slice(0, MAX_NAME - 1).join("").trimEnd()}…` : flat;
}

const MAX_ICON = 100_000;
const ICON = /^data:image\/(?:png|jpeg|webp|gif|svg\+xml)(?:;[\w=.+-]+)*,/i;

/** Accepts only a data: image of a known type and limited size; anything else (a web address, script) is dropped. */
export function cleanIcon(icon: string): string | null {
  return icon.length <= MAX_ICON && ICON.test(icon) ? icon : null;
}

// Letters of other alphabets (and digits) that look like Latin letters, so "MetaМask" or "C0inbase" are caught too.
const LOOKALIKE: Readonly<Record<string, string>> = {
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i", ј: "j", ѕ: "s",
  ԁ: "d", ɑ: "a", α: "a", β: "b", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
  "0": "o", "1": "l", "3": "e", "5": "s",
};

/** Comparable form of a name: no accents, lower case, look-alike letters folded, only a-z. */
export function nameKey(name: string): string {
  return Array.from(name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase())
    .map((ch) => LOOKALIKE[ch] ?? ch)
    .join("")
    .replace(/[^a-z]/g, "");
}

/** True when the name contains the name of one of our wallets ("MetaMask", "Coinbase", "Rabby", "Phantom"). */
export function imitates(name: string): boolean {
  const key = nameKey(name);
  return PROTECTED.some((p) => key.includes(p));
}

/** Address shown under the install button: host and path, without "https://" or "www.". */
export function displayUrl(url: string): string {
  const u = new URL(url);
  const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
  return `${u.host.replace(/^www\./, "")}${path}`;
}
