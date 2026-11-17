import { encodeFunctionResult, getAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { wrapperAbi } from "@deployment";
import { erc20ReadAbi } from "../contracts/generated/erc20";
import { multicall3, multicall3Abi } from "../contracts/generated/multicall3";
import type { DeployedAsset } from "../contracts/types";
import { deploymentInfo } from "./network";
import { decodeSnapshot, PARAM_FUNCTIONS, snapshotCalls, sortOverview, type CallResult } from "./plan";

const DAY = 86_400n;
const ACCOUNT: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const HEIR_A: Address = getAddress("0x00000000000000000000000000000000000000a1");
const HEIR_B: Address = getAddress("0x00000000000000000000000000000000000000b2");
const CONTACT: Address = getAddress("0x00000000000000000000000000000000000000c3");
const assets = deploymentInfo.assets;
const asset = (ticker: string): DeployedAsset => {
  const a = assets.find((x) => x.ticker === ticker);
  if (a === undefined) throw new Error(ticker);
  return a;
};

const WALLET_ETH = 9_999n * 10n ** 18n;
const PARAMS = [15n * DAY, 30n * DAY, 7n * DAY, 14n * DAY, 7n * DAY, 30n * DAY, 30n, 30n, 30n, 30n, 15n, 10n];

/** userInfo with the given heirCount and recoveryUserCount (the rest, example values). */
const userInfo = (heirs: bigint, contacts: bigint, activity = 1_790_000_000n) =>
  [0n, 0n, 0n, 0n, 0n, activity, heirs, contacts, false, 0n, false, 0n, false] as const;

const UNDERLYING_WALLET = 1_000_000n * 10n ** 18n;
const ALLOWANCE = 7n * 10n ** 18n;

/** Results as aggregate3 would return them for `snapshotCalls(assets, selected, ACCOUNT)`. */
function results(
  selected: DeployedAsset,
  balanceOf: (t: string) => bigint,
  hasPlan: (t: string) => boolean,
  treasuries: readonly Address[] = [],
): CallResult[] {
  const ok = (returnData: Hex): CallResult => ({ success: true, returnData });
  const out: CallResult[] = [ok(encodeFunctionResult({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp", result: 1_791_000_000n }))];
  PARAM_FUNCTIONS.forEach((functionName, i) => {
    out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName, result: PARAMS[i] ?? 0n })));
  });
  out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", result: balanceOf(selected.ticker) })));
  out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", result: userInfo(2n, 1n) })));
  out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", result: [[HEIR_A, HEIR_B], [6_000n, 4_000n]] })));
  out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", result: [CONTACT] })));
  for (const a of assets) {
    out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", result: balanceOf(a.ticker) })));
    const p = hasPlan(a.ticker);
    out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", result: userInfo(p ? 1n : 0n, 0n) })));
  }
  out.push(ok(encodeFunctionResult({ abi: multicall3Abi, functionName: "getEthBalance", result: WALLET_ETH })));
  out.push(ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getTreasuries", result: [treasuries, treasuries.map(() => 10_000n / BigInt(treasuries.length))] })));
  if (selected.underlying.kind === "erc20") {
    out.push(ok(encodeFunctionResult({ abi: erc20ReadAbi, functionName: "balanceOf", result: UNDERLYING_WALLET })));
    out.push(ok(encodeFunctionResult({ abi: erc20ReadAbi, functionName: "allowance", result: ALLOWANCE })));
  }
  return out;
}

const balances = (t: string) => (t === "DAI" ? 5n * 10n ** 18n : 0n);
const plans = (t: string) => t === "DAI" || t === "LINK";

describe("snapshotCalls", () => {
  const acct = ACCOUNT.slice(2).toLowerCase().padStart(64, "0");

  it("ERC-20: time, 12 parameters, 4 of the plan, 2 per asset, wallet ETH, treasuries, balance and approval of the underlying; none can fail", () => {
    const dai = asset("DAI");
    if (dai.underlying.kind !== "erc20") throw new Error("DAI");
    const calls = snapshotCalls(assets, dai, ACCOUNT);
    expect(calls).toHaveLength(1 + 12 + 4 + 2 * 29 + 1 + 1 + 2);
    expect(calls[0]).toEqual({ target: multicall3.address, allowFailure: false, callData: "0x0f28c97d" });
    expect(calls.slice(1, 17).every((c) => c.target === dai.address)).toBe(true);
    expect(calls.slice(-4)).toEqual([
      { target: multicall3.address, allowFailure: false, callData: `0x4d2301cc${acct}` },
      { target: dai.address, allowFailure: false, callData: "0x0d9b5011" },
      { target: dai.underlying.address, allowFailure: false, callData: `0x70a08231${acct}` },
      // allowance(account, wrapper): the spender is the wrapper of the asset.
      { target: dai.underlying.address, allowFailure: false, callData: `0xdd62ed3e${acct}${dai.address.slice(2).toLowerCase().padStart(64, "0")}` },
    ]);
    expect(new Set(calls.map((c) => c.allowFailure))).toEqual(new Set([false]));
  });

  it("ETH: no reads of the underlying (77 calls)", () => {
    const calls = snapshotCalls(assets, asset("ETH"), ACCOUNT);
    expect(calls).toHaveLength(1 + 12 + 4 + 2 * 29 + 1 + 1);
    expect(calls[calls.length - 1]).toEqual({ target: asset("ETH").address, allowFailure: false, callData: "0x0d9b5011" });
  });
});

describe("decodeSnapshot", () => {
  it("interprets everything read in the same call", () => {
    const s = decodeSnapshot(assets, asset("DAI"), ACCOUNT, results(asset("DAI"), balances, plans));
    expect(s.account).toBe(ACCOUNT);
    expect(s.ticker).toBe("DAI");
    expect(s.blockTimestamp).toBe(1_791_000_000n);
    expect(s.walletEth).toBe(WALLET_ETH);
    expect(s.isTreasury).toBe(false);
    expect(s.underlying).toEqual({ wallet: UNDERLYING_WALLET, allowance: ALLOWANCE });
    expect(s.params.recoveryInactivityPeriod).toBe(15n * DAY);
    expect(s.params.maxRecoveryUsers).toBe(10n);
    expect(s.plan.balance).toBe(5n * 10n ** 18n);
    expect(s.plan.heirs).toEqual([
      { wallet: HEIR_A, bps: 6_000n },
      { wallet: HEIR_B, bps: 4_000n },
    ]);
    expect(s.plan.recoveryUsers).toEqual([CONTACT]);
    expect(sortOverview(s.overview).slice(0, 2).map((o) => o.asset.ticker)).toEqual(["DAI", "LINK"]);
  });

  it("summary of each asset with its last activity and its processes in progress (getUserInfo of the same asset)", () => {
    const sel = asset("DAI");
    const r = results(sel, balances, plans);
    const at = (ticker: string) => 17 + 2 * assets.findIndex((a) => a.ticker === ticker) + 1;
    const info = (activity: bigint, inheritance: boolean, recovery: boolean) =>
      ({ success: true, returnData: encodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", result: [0n, 0n, 0n, 0n, 0n, activity, 1n, 0n, inheritance, 0n, recovery, 0n, false] }) }) as const;
    r[at("LINK")] = info(1_700_000_000n, true, false);
    r[at("UNI")] = info(1_600_000_000n, false, true);
    const s = decodeSnapshot(assets, sel, ACCOUNT, r);
    const of = (ticker: string) => s.overview.find((o) => o.asset.ticker === ticker);
    expect(of("LINK")).toMatchObject({ hasPlan: true, activityTimestamp: 1_700_000_000n, inheritanceStarted: true, recoveryStarted: false });
    expect(of("UNI")).toMatchObject({ hasPlan: true, activityTimestamp: 1_600_000_000n, inheritanceStarted: false, recoveryStarted: true });
    expect(of("DAI")).toMatchObject({ activityTimestamp: 1_790_000_000n, inheritanceStarted: false, recoveryStarted: false });
  });

  it("rejects a failed read, a different number of results or lists that do not match", () => {
    const sel = asset("DAI");
    const good = results(sel, balances, plans);
    const failed = [...good];
    failed[5] = { success: false, returnData: "0x" };
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, failed)).toThrow(/Read 5 failed/);
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, good.slice(1))).toThrow(/expected 79/);
    const counts = [...good];
    counts[14] = { success: true, returnData: encodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", result: userInfo(3n, 1n) }) };
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, counts)).toThrow(/count does not match/);
  });

  it("treasury: recognizes the account in getTreasuries case-insensitively; ETH without underlying", () => {
    const eth = asset("ETH");
    const s = decodeSnapshot(assets, eth, ACCOUNT, results(eth, balances, plans, [HEIR_A, getAddress(ACCOUNT.toLowerCase())]));
    expect(s.isTreasury).toBe(true);
    expect(s.underlying).toBeNull();
    const r = results(eth, balances, plans, [HEIR_A]);
    expect(decodeSnapshot(assets, eth, ACCOUNT, r).isTreasury).toBe(false);
    const bad = [...r];
    bad[bad.length - 1] = { success: true, returnData: encodeFunctionResult({ abi: wrapperAbi, functionName: "getTreasuries", result: [[HEIR_A], []] }) };
    expect(() => decodeSnapshot(assets, eth, ACCOUNT, bad)).toThrow(/getTreasuries returned lists of different length/);
  });

  it("rejects that the balance of the chosen asset differs between reads", () => {
    const sel = asset("DAI");
    const r = results(sel, balances, plans);
    r[13] = { success: true, returnData: encodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", result: 1n }) };
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, r)).toThrow(/differs between reads/);
  });
});

describe("decodeSnapshot: rules of the frozen code of the contracts (bounds.ts)", () => {
  const REJECT = /Value contradicts the deployed contracts/;
  const ok = (returnData: Hex): CallResult => ({ success: true, returnData });
  const sel = asset("DAI");

  it("rejects a fee, a period, a relation between periods or a cap outside the rules", () => {
    const tax = results(sel, balances, plans);
    tax[1 + 6] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "wrappingTax", result: 31n }));
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, tax)).toThrow(REJECT);
    const period = results(sel, balances, plans);
    period[1] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "recoveryInactivityPeriod", result: 14n * DAY - 1n }));
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, period)).toThrow(REJECT);
    const relation = results(sel, balances, plans);
    relation[1] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "recoveryInactivityPeriod", result: 30n * DAY }));
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, relation)).toThrow(REJECT);
    const cap = results(sel, balances, plans);
    cap[1 + 10] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "maxHeirs", result: 41n }));
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, cap)).toThrow(REJECT);
  });

  it("rejects repeated heirs, the owner as contact or the contract itself as treasury", () => {
    const heirs = results(sel, balances, plans);
    heirs[15] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", result: [[HEIR_A, HEIR_A], [6_000n, 4_000n]] }));
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, heirs)).toThrow(REJECT);
    const contacts = results(sel, balances, plans);
    contacts[16] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", result: [ACCOUNT] }));
    expect(() => decodeSnapshot(assets, sel, ACCOUNT, contacts)).toThrow(REJECT);
    const eth = asset("ETH");
    expect(() => decodeSnapshot(assets, eth, ACCOUNT, results(eth, balances, plans, [eth.address]))).toThrow(REJECT);
  });
});
