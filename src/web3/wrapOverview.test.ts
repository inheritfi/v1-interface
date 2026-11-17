import { encodeFunctionResult, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { wrapperAbi } from "@deployment";
import { erc20ReadAbi } from "../contracts/generated/erc20";
import { multicall3, multicall3Abi } from "../contracts/generated/multicall3";
import type { DeployedAsset } from "../contracts/types";
import { deploymentInfo } from "./network";
import type { CallResult } from "./plan";
import { decodeWrap, sortWrapRows, wrapCalls } from "./wrapOverview";

const ACCOUNT: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const assets = deploymentInfo.assets;
const asset = (ticker: string): DeployedAsset => {
  const a = assets.find((x) => x.ticker === ticker);
  if (a === undefined) throw new Error(ticker);
  return a;
};
const acct = ACCOUNT.slice(2).toLowerCase().padStart(64, "0");
const pad = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");
const WALLET_ETH = 9_999n * 10n ** 18n;

/** Results as aggregate3 would return them for `wrapCalls(assets, selected, ACCOUNT)`. */
function results(opts: {
  wrapped: (t: string) => bigint;
  wallet: (t: string) => bigint;
  allowance: (t: string) => bigint;
  treasuries?: readonly Address[];
  taxes?: [bigint, bigint];
}): CallResult[] {
  const ok = (returnData: Hex): CallResult => ({ success: true, returnData });
  const out: CallResult[] = [ok(encodeFunctionResult({ abi: multicall3Abi, functionName: "getEthBalance", result: WALLET_ETH }))];
  for (const a of assets) {
    out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", result: opts.wrapped(a.ticker) })));
    if (a.underlying.kind === "erc20") {
      out.push(ok(encodeFunctionResult({ abi: erc20ReadAbi, functionName: "balanceOf", result: opts.wallet(a.ticker) })));
      out.push(ok(encodeFunctionResult({ abi: erc20ReadAbi, functionName: "allowance", result: opts.allowance(a.ticker) })));
    }
  }
  const [w, u] = opts.taxes ?? [30n, 20n];
  out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "wrappingTax", result: w })));
  out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "unwrappingTax", result: u })));
  const t = opts.treasuries ?? [];
  out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getTreasuries", result: [t, t.map(() => 10_000n / BigInt(t.length))] })));
  return out;
}

const none = () => 0n;

describe("wrapCalls", () => {
  it("wallet ETH, 1 call per ETH and 3 per ERC-20, and 3 of the chosen asset: 86 in total; none can fail", () => {
    const dai = asset("DAI");
    if (dai.underlying.kind !== "erc20") throw new Error("DAI");
    const calls = wrapCalls(assets, dai, ACCOUNT);
    expect(assets.filter((a) => a.underlying.kind === "erc20")).toHaveLength(28);
    expect(calls).toHaveLength(1 + 1 + 28 * 3 + 3);
    expect(new Set(calls.map((c) => c.allowFailure))).toEqual(new Set([false]));
    expect(calls[0]).toEqual({ target: multicall3.address, allowFailure: false, callData: `0x4d2301cc${acct}` });
    // ETH (first asset of the manifest): only balanceOf of the iToken.
    const eth = asset("ETH");
    expect(assets[0]).toBe(eth);
    expect(calls[1]).toEqual({ target: eth.address, allowFailure: false, callData: `0x70a08231${acct}` });
    // DAI: balanceOf of the iToken, balanceOf of the underlying and allowance(account, DAI wrapper).
    const i = 2 + 3 * (assets.indexOf(dai) - 1);
    expect(calls.slice(i, i + 3)).toEqual([
      { target: dai.address, allowFailure: false, callData: `0x70a08231${acct}` },
      { target: dai.underlying.address, allowFailure: false, callData: `0x70a08231${acct}` },
      { target: dai.underlying.address, allowFailure: false, callData: `0xdd62ed3e${acct}${pad(dai.address)}` },
    ]);
    // wrappingTax, unwrappingTax and getTreasuries of the chosen asset.
    expect(calls.slice(-3).map((c) => c.target)).toEqual([dai.address, dai.address, dai.address]);
    expect(calls.at(-1)?.callData).toBe("0x0d9b5011");
  });

  it("each allowance points to the wrapper of its own asset", () => {
    const calls = wrapCalls(assets, asset("ETH"), ACCOUNT);
    let i = 2;
    for (const a of assets.slice(1)) {
      if (a.underlying.kind !== "erc20") throw new Error(a.ticker);
      expect(calls[i + 2]).toEqual({ target: a.underlying.address, allowFailure: false, callData: `0xdd62ed3e${acct}${pad(a.address)}` });
      i += 3;
    }
  });
});

describe("decodeWrap", () => {
  it("interprets balances, approvals, fees and treasury", () => {
    const r = decodeWrap(
      assets,
      asset("CRV"),
      ACCOUNT,
      results({
        wrapped: (t) => (t === "LDO" ? 5n : 0n),
        wallet: (t) => (t === "CRV" ? 7n : 0n),
        allowance: (t) => (t === "WBTC" ? 3n : 0n),
        treasuries: [ACCOUNT],
        taxes: [30n, 25n],
      }),
    );
    expect(r.rows).toHaveLength(29);
    const row = (t: string) => r.rows.find((x) => x.asset.ticker === t);
    expect(row("ETH")).toEqual({ asset: asset("ETH"), wrapped: 0n, wallet: WALLET_ETH, allowance: null });
    expect(row("LDO")?.wrapped).toBe(5n);
    expect(row("CRV")?.wallet).toBe(7n);
    expect(row("WBTC")?.allowance).toBe(3n);
    expect(r.wrappingTax).toBe(30n);
    expect(r.unwrappingTax).toBe(25n);
    expect(r.isTreasury).toBe(true);
    expect(r.ticker).toBe("CRV");
  });

  it("the treasury is compared case-insensitively and another wallet does not count", () => {
    const lower = ACCOUNT.toLowerCase() as Address;
    expect(decodeWrap(assets, asset("DAI"), ACCOUNT, results({ wrapped: none, wallet: none, allowance: none, treasuries: [lower] })).isTreasury).toBe(true);
    expect(
      decodeWrap(assets, asset("DAI"), ACCOUNT, results({ wrapped: none, wallet: none, allowance: none, treasuries: ["0x00000000000000000000000000000000000000a1"] }))
        .isTreasury,
    ).toBe(false);
  });

  it("rejects a different number of results, a failed call or an asset outside the deployment", () => {
    const good = results({ wrapped: none, wallet: none, allowance: none });
    expect(() => decodeWrap(assets, asset("DAI"), ACCOUNT, good.slice(1))).toThrow(/expected 89/);
    const failed = [...good];
    failed[5] = { success: false, returnData: "0x" };
    expect(() => decodeWrap(assets, asset("DAI"), ACCOUNT, failed)).toThrow(/Read 5 failed/);
    const foreign: DeployedAsset = { ...asset("DAI"), ticker: "XYZ" };
    expect(() => decodeWrap(assets, foreign, ACCOUNT, good)).toThrow(/not in the deployment/);
  });
});

describe("sortWrapRows", () => {
  it("first those that have something in the wallet, wrapped or approved, in the order of the manifest", () => {
    const r = decodeWrap(
      assets,
      asset("DAI"),
      ACCOUNT,
      results({ wrapped: (t) => (t === "WBTC" ? 1n : 0n), wallet: (t) => (t === "CRV" ? 1n : 0n), allowance: (t) => (t === "LDO" ? 1n : 0n) }),
    );
    // ETH has balance in the wallet (WALLET_ETH), so it also goes first.
    expect(
      sortWrapRows(r.rows)
        .slice(0, 4)
        .map((x) => x.asset.ticker),
    ).toEqual(["ETH", "CRV", "LDO", "WBTC"]);
    expect(sortWrapRows(r.rows)).toHaveLength(29);
  });
});

describe("decodeWrap: rules of the frozen code of the contracts (bounds.ts)", () => {
  const REJECT = /Value contradicts the deployed contracts/;

  it("rejects fees above 30 or the contract itself as treasury", () => {
    const dai = asset("DAI");
    expect(decodeWrap(assets, dai, ACCOUNT, results({ wrapped: none, wallet: none, allowance: none, taxes: [30n, 0n] })).wrappingTax).toBe(30n);
    expect(() => decodeWrap(assets, dai, ACCOUNT, results({ wrapped: none, wallet: none, allowance: none, taxes: [31n, 0n] }))).toThrow(REJECT);
    expect(() => decodeWrap(assets, dai, ACCOUNT, results({ wrapped: none, wallet: none, allowance: none, taxes: [0n, 10_000n] }))).toThrow(REJECT);
    expect(() => decodeWrap(assets, dai, ACCOUNT, results({ wrapped: none, wallet: none, allowance: none, treasuries: [dai.address] }))).toThrow(REJECT);
  });
});
