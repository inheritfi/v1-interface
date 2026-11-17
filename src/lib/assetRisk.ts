/**
 * Risk of each asset before wrapping it (the interface shows the concrete risk of each
 * asset before the wrap). Classification verified on-chain; the pause of WBTC and FET was verified on 2026-10-13.
 * No text includes multisig thresholds: they can change.
 */

import { t, type MessageKey } from "../i18n";

export type RiskKind = "native" | "standard" | "pausable" | "governance";

/** Classification with the keys of its texts (the notice is written in the current language with assetRisk()). */
export interface AssetRiskEntry {
  kind: RiskKind;
  notice: { title: MessageKey; body: MessageKey } | null;
}

export interface AssetRisk {
  kind: RiskKind;
  /** Only for "pausable" and "governance": notice shown before wrapping. The full text is title + " " + body. */
  notice: { title: string; body: string } | null;
}

const STANDARD: AssetRiskEntry = { kind: "standard", notice: null };

/** The 24 without issuer powers over the balances (GHO, POL and STRK verified on-chain on 2026-11-03,
 * record 22aj: their issuers can only mint). */
const STANDARD_TICKERS = [
  "WETH",
  "DAI",
  "LINK",
  "UNI",
  "SHIB",
  "SKY",
  "wstETH",
  "WLD",
  "INJ",
  "PENDLE",
  "POL",
  "CRV",
  "crvUSD",
  "GHO",
  "GRT",
  "ETHFI",
  "COMP",
  "ENS",
  "IMX",
  "STRK",
  "CVX",
  "JASMY",
  "PEPE",
  "AXS",
] as const;

export const ASSET_RISK: Readonly<Record<string, AssetRiskEntry>> = {
  ETH: { kind: "native", notice: null },
  ...Object.fromEntries(STANDARD_TICKERS.map((x) => [x, STANDARD])),
  FET: {
    kind: "pausable",
    notice: { title: "risk.fetTitle", body: "risk.fetBody" },
  },
  WBTC: {
    kind: "pausable",
    notice: { title: "risk.wbtcTitle", body: "risk.wbtcBody" },
  },
  AAVE: {
    kind: "governance",
    notice: { title: "risk.aaveTitle", body: "risk.aaveBody" },
  },
  LDO: {
    kind: "governance",
    notice: { title: "risk.ldoTitle", body: "risk.ldoBody" },
  },
};

/** Risk of an asset by its ticker. Throws if it is not classified: an asset is never shown without its risk. */
export function assetRisk(ticker: string): AssetRisk {
  const r = Object.hasOwn(ASSET_RISK, ticker) ? ASSET_RISK[ticker] : undefined;
  if (r === undefined) throw new Error(`No risk classification for ${ticker}`);
  return { kind: r.kind, notice: r.notice === null ? null : { title: t(r.notice.title), body: t(r.notice.body) } };
}

const RISK_LABELS: Readonly<Record<RiskKind, MessageKey>> = {
  native: "risk.native",
  standard: "risk.standard",
  pausable: "risk.notice",
  governance: "risk.notice",
};

/** Short label of the risk (Native / Standard / Notice) in the current language. */
export function riskLabel(kind: RiskKind): string {
  return t(RISK_LABELS[kind]);
}
