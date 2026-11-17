// INHERITFI: documentation data. Everything comes from the same sources as the app and the site: periods, fees and
// ranges from site/params.ts, contracts from the manifest of the
// environment (@deployment), risk of each asset from src/lib/assetRisk.ts and licenses from site/docs/license.ts.
import { deployment } from "@deployment";
import type { DeployedAsset, Deployment } from "../../src/contracts/types";
import { assetRisk, type RiskKind } from "../../src/lib/assetRisk";
import { productionHosts, socialOf, type SiteConfig, type SocialLinks } from "../config";
import { formatFee, MAX_TAX_BPS, PERIOD_RANGES_DAYS, type ProtocolParams } from "../params";
import { CORE_LICENSE, INTERFACE_LICENSE, type LicenseParams } from "./license";

const DAY = 86_400n;
type PeriodName = keyof typeof PERIOD_RANGES_DAYS;

export interface DocsData {
  readonly p: ProtocolParams;
  /** The four fees of the deployment (equal; otherwise the build fails). */
  readonly fee: string;
  readonly maxFee: string;
  readonly maxHeirs: bigint;
  readonly nAssets: number;
  readonly chainId: number;
  readonly network: string;
  readonly manifestSha256: string;
  readonly owner: string;
  readonly libraries: Deployment["libraries"];
  readonly assets: readonly DeployedAsset[];
  readonly risk: (ticker: string) => RiskKind;
  readonly ranges: Readonly<Record<PeriodName, string>>;
  readonly social: SocialLinks;
  readonly siteHost: string;
  readonly appHost: string;
  readonly license: { readonly core: LicenseParams; readonly iface: LicenseParams };
}

/** Whole days of a period; throws if they are not whole days (the documentation writes them as "N days"). */
export function wholeDays(seconds: bigint): bigint {
  if (seconds <= 0n || seconds % DAY !== 0n) throw new Error(`Period is not a whole number of days: ${seconds.toString()} s`);
  return seconds / DAY;
}

/** "15 days" (o "1 day"). */
export function days(seconds: bigint): string {
  const n = wholeDays(seconds);
  return `${n.toString()} ${n === 1n ? "day" : "days"}`;
}

/** Network name of the manifest. */
export function networkName(chainId: number): string {
  if (chainId === 1) return "Ethereum";
  throw new Error(`Unknown chain ${String(chainId)}`);
}

export function docsData(config: SiteConfig, p: ProtocolParams): DocsData {
  const taxes = [p.wrappingTax, p.unwrappingTax, p.inheritanceTax, p.recoveryTax];
  if (new Set(taxes).size !== 1) throw new Error("The docs describe one fee for all four operations");
  const ranges = Object.fromEntries(
    Object.entries(PERIOD_RANGES_DAYS).map(([k, r]) => [k, `${r.min.toString()} to ${r.max.toString()} days`]),
  ) as Record<PeriodName, string>;
  const hosts = productionHosts();
  return {
    p,
    fee: formatFee(p.wrappingTax),
    maxFee: formatFee(MAX_TAX_BPS),
    maxHeirs: p.maxHeirs,
    nAssets: deployment.assets.length,
    chainId: deployment.chainId,
    network: networkName(deployment.chainId),
    manifestSha256: deployment.manifestSha256,
    owner: deployment.owner,
    libraries: deployment.libraries,
    assets: deployment.assets,
    risk: (ticker) => assetRisk(ticker).kind,
    ranges,
    social: socialOf(config),
    siteHost: hosts.site,
    appHost: hosts.app,
    license: { core: CORE_LICENSE, iface: INTERFACE_LICENSE },
  };
}

/** iToken symbol of an asset of the manifest. */
export function iTokenOf(d: DocsData, ticker: string): string {
  const a = d.assets.find((x) => x.ticker === ticker);
  if (a === undefined) throw new Error(`Unknown asset ${ticker}`);
  return a.iToken.symbol;
}
