import { describe, expect, it } from "vitest";
import { deploymentInfo } from "../web3/network";
import { ASSET_RISK, assetRisk } from "./assetRisk";

describe("assetRisk", () => {
  it("classifies exactly the 29 assets of the manifest, not one more", () => {
    const tickers = deploymentInfo.assets.map((a) => a.ticker).sort();
    expect(tickers).toHaveLength(29);
    expect(Object.keys(ASSET_RISK).sort()).toEqual(tickers);
  });

  it("native ETH; 24 standard (with GHO); FET and WBTC pausable; AAVE and LDO by governance", () => {
    const by = (k: string) =>
      Object.entries(ASSET_RISK)
        .filter(([, r]) => r.kind === k)
        .map(([t]) => t)
        .sort();
    expect(by("native")).toEqual(["ETH"]);
    expect(by("standard")).toHaveLength(24);
    expect(by("standard")).toContain("GHO");
    expect(by("pausable")).toEqual(["FET", "WBTC"]);
    expect(by("governance")).toEqual(["AAVE", "LDO"]);
  });

  it("only the assets with a notice have text, and the full text is the approved one", () => {
    for (const [t, r] of Object.entries(ASSET_RISK)) {
      expect(r.notice !== null).toBe(r.kind === "pausable" || r.kind === "governance");
      const n = assetRisk(t).notice;
      if (n !== null) expect(n.title + " " + n.body).toMatch(new RegExp(t === "LDO" ? "LDO" : t));
    }
    const full = (t: string) => {
      const n = assetRisk(t).notice;
      return n === null ? "" : `${n.title} ${n.body}`;
    };
    expect(full("WBTC")).toBe(
      "WBTC can be paused. WBTC's issuer can pause all WBTC transfers. While paused, you can't wrap or unwrap WBTC, or approve or cancel an approval. Your iWBTC stay backed 1:1, and inheritance and recovery of iWBTC keep working.",
    );
    expect(full("FET")).toBe(
      "FET can be paused. FET's issuer can pause all FET transfers. While paused, you can't wrap or unwrap FET. Your iFET stay backed 1:1, and inheritance and recovery of iFET keep working.",
    );
    expect(full("AAVE")).toBe(
      "AAVE is an upgradeable contract controlled by Aave governance through on-chain votes. An upgrade could change how AAVE balances or transfers work. INHERITFI can't prevent it.",
    );
    expect(full("LDO")).toBe(
      "Lido DAO governance controls LDO through on-chain votes: it can move any holder's LDO without permission, burn it, and freeze transfers. INHERITFI can't prevent it.",
    );
  });

  it("an unclassified ticker throws (and is not confused with Object properties)", () => {
    expect(() => assetRisk("XYZ")).toThrow(/No risk classification/);
    expect(() => assetRisk("toString")).toThrow(/No risk classification/);
    expect(() => assetRisk("weth")).toThrow(/No risk classification/);
  });
});
