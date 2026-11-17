import type { DeployedAsset } from "../contracts/types";

/**
 * Search of assets by ticker or by iToken (WBTC or iWBTC), case-insensitive and by partial match.
 * It only filters the verified list of the manifest: it never adds tokens or queries anything outside.
 */
export function matchesAsset(asset: DeployedAsset, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return asset.ticker.toLowerCase().includes(q) || asset.iToken.symbol.toLowerCase().includes(q);
}
