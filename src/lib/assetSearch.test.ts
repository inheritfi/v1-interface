import { describe, expect, it } from "vitest";
import { deploymentInfo } from "../web3/network";
import { matchesAsset } from "./assetSearch";

const find = (q: string) =>
  deploymentInfo.assets
    .filter((a) => matchesAsset(a, q))
    .map((a) => a.ticker)
    .sort();

describe("matchesAsset", () => {
  it("empty or only spaces: all", () => {
    expect(find("")).toHaveLength(29);
    expect(find("   ")).toHaveLength(29);
  });

  it("by ticker and by iToken, case-insensitive", () => {
    expect(find("WBTC")).toEqual(["WBTC"]);
    expect(find("wbtc")).toEqual(["WBTC"]);
    expect(find("iWBTC")).toEqual(["WBTC"]);
    expect(find("IWB")).toEqual(["WBTC"]);
    expect(find(" ldo ")).toEqual(["LDO"]);
    expect(find("crvusd")).toEqual(["crvUSD"]);
  });

  it("partial match: 'eth' finds all those that contain it", () => {
    expect(find("eth")).toEqual(["ETH", "ETHFI", "WETH", "wstETH"]);
  });

  it("no matches", () => {
    expect(find("usdc")).toEqual([]);
    expect(find("0x01c1")).toEqual([]);
  });
});
