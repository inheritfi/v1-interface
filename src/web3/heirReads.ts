import { decodeFunctionResult, encodeFunctionData, isAddressEqual, type Address, type Hex, type PublicClient } from "viem";
import { wrapperAbi } from "@deployment";
import { multicall3, multicall3Abi } from "../contracts/generated/multicall3";
import type { DeployedAsset } from "../contracts/types";
import type { HeirInfo, HeirParams, OwnerAssetReads } from "../lib/heirStatus";
import { checkContacts, checkHeirs, checkPeriod, checkTax } from "./bounds";
import type { CallResult } from "./plan";

/**
 * View of the heir (and of the contact) from the owner's address. The contract does not store "heir →
 * owners": with the owner's address the 29 assets are checked in ONE eth_call (aggregate3, allowFailure: false).
 *   1. Roles: getHeirs(owner) and getRecoveryUsers(owner) in each asset.
 *   2. Detail of the chosen asset: block time, 5 parameters, getUserInfo and balance of the owner, getHeirs and
 *      getHeirInheritanceInfo(owner, h) of EACH heir (to know who already claimed). If the list changed between
 *      the two reads, the second one fails or does not match and nothing is shown until the next read.
 */

interface Call3 {
  target: Address;
  allowFailure: false;
  callData: Hex;
}
const call = (target: Address, callData: Hex): Call3 => ({ target, allowFailure: false, callData });
const data = (results: readonly CallResult[], i: number): Hex => {
  const r = results[i];
  if (r?.success !== true) throw new Error(`Read ${String(i)} failed`);
  return r.returnData;
};

export interface AssetRole {
  asset: DeployedAsset;
  /** Percentage of the heir in basis points, or null if it is not an heir in this asset. */
  heirBps: bigint | null;
  isContact: boolean;
  /** Full list of heirs of the owner in this asset (to request the detail). */
  heirs: Address[];
}

export interface Roles {
  owner: Address;
  me: Address;
  roles: AssetRole[];
}

export function rolesCalls(assets: readonly DeployedAsset[], owner: Address): Call3[] {
  return assets.flatMap((a) => [
    call(a.address, encodeFunctionData({ abi: wrapperAbi, functionName: "getHeirs", args: [owner] })),
    call(a.address, encodeFunctionData({ abi: wrapperAbi, functionName: "getRecoveryUsers", args: [owner] })),
  ]);
}

export function decodeRoles(assets: readonly DeployedAsset[], owner: Address, me: Address, results: readonly CallResult[]): Roles {
  if (results.length !== 2 * assets.length) throw new Error(`Multicall3 returned ${String(results.length)} results, expected ${String(2 * assets.length)}`);
  const roles = assets.map((asset, i) => {
    const [wallets, pcts] = decodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", data: data(results, 2 * i) });
    if (wallets.length !== pcts.length) throw new Error("getHeirs returned lists of different length");
    const contacts = decodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", data: data(results, 2 * i + 1) });
    checkHeirs(owner, wallets, pcts);
    checkContacts(owner, contacts);
    const k = wallets.findIndex((w) => isAddressEqual(w, me));
    return { asset, heirBps: k >= 0 ? (pcts[k] ?? null) : null, isContact: contacts.some((c) => isAddressEqual(c, me)), heirs: [...wallets] };
  });
  return { owner, me, roles };
}

export async function readRoles(client: PublicClient, assets: readonly DeployedAsset[], owner: Address, me: Address): Promise<Roles> {
  const results = await client.readContract({ address: multicall3.address, abi: multicall3Abi, functionName: "aggregate3", args: [rolesCalls(assets, owner)] });
  return decodeRoles(assets, owner, me, results);
}

export interface HeirDetail {
  owner: Address;
  me: Address;
  ticker: string;
  blockTimestamp: bigint;
  params: HeirParams;
  reads: OwnerAssetReads;
  heirs: HeirInfo[];
}

const PARAMS = ["inheritInactivityPeriod", "inheritWaitingTime", "inheritRemainingWaitingTime", "recoveryExecutionWindow", "inheritanceTax"] as const;

/** `heirs`: the list of heirs read in the roles read (it is read again and must match). */
export function detailCalls(asset: DeployedAsset, owner: Address, heirs: readonly Address[]): Call3[] {
  const w = asset.address;
  return [
    call(multicall3.address, encodeFunctionData({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp" })),
    ...PARAMS.map((functionName) => call(w, encodeFunctionData({ abi: wrapperAbi, functionName }))),
    call(w, encodeFunctionData({ abi: wrapperAbi, functionName: "getUserInfo", args: [owner] })),
    call(w, encodeFunctionData({ abi: wrapperAbi, functionName: "balanceOf", args: [owner] })),
    call(w, encodeFunctionData({ abi: wrapperAbi, functionName: "getHeirs", args: [owner] })),
    ...heirs.map((h) => call(w, encodeFunctionData({ abi: wrapperAbi, functionName: "getHeirInheritanceInfo", args: [owner, h] }))),
  ];
}

export function decodeDetail(asset: DeployedAsset, owner: Address, me: Address, heirs: readonly Address[], results: readonly CallResult[]): HeirDetail {
  const expected = 1 + PARAMS.length + 3 + heirs.length;
  if (results.length !== expected) throw new Error(`Multicall3 returned ${String(results.length)} results, expected ${String(expected)}`);
  const blockTimestamp = decodeFunctionResult({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp", data: data(results, 0) });
  if (blockTimestamp <= 0n) throw new Error("Invalid block timestamp");
  const p = PARAMS.map((functionName, k) => {
    const v: unknown = decodeFunctionResult({ abi: wrapperAbi, functionName, data: data(results, 1 + k) });
    if (typeof v !== "bigint") throw new Error(`Unexpected value for ${functionName}`);
    return v;
  });
  const at = (k: number) => {
    const v = p[k];
    if (v === undefined) throw new Error("Missing parameter");
    return v;
  };
  const params: HeirParams = {
    inheritInactivityPeriod: at(0),
    inheritWaitingTime: at(1),
    inheritRemainingWaitingTime: at(2),
    recoveryExecutionWindow: at(3),
    inheritanceTax: at(4),
  };
  // Rules of the frozen code of the contracts (bounds.ts): a value that contradicts them is rejected.
  checkPeriod("inheritInactivityPeriod", params.inheritInactivityPeriod);
  checkPeriod("inheritWaitingTime", params.inheritWaitingTime);
  checkPeriod("inheritRemainingWaitingTime", params.inheritRemainingWaitingTime);
  checkPeriod("recoveryExecutionWindow", params.recoveryExecutionWindow);
  checkTax("inheritanceTax", params.inheritanceTax);
  const b = 1 + PARAMS.length;
  const info = decodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", data: data(results, b) });
  const balance = decodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", data: data(results, b + 1) });
  const [wallets, pcts] = decodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", data: data(results, b + 2) });
  // The list must be the same one with which the details were requested (same order).
  if (wallets.length !== heirs.length || wallets.some((w, i) => !isAddressEqual(w, heirs[i] ?? "0x0000000000000000000000000000000000000000"))) {
    throw new Error("The heirs changed between reads");
  }
  if (pcts.length !== wallets.length) throw new Error("getHeirs returned lists of different length");
  checkHeirs(owner, wallets, pcts);
  // getUserInfo (InheritfiV1Base.sol l. 388-405): [5] activityTimestamp, [6] heirCount, [8] inheritanceStarted,
  // [9] inheritanceStartTimestamp, [10] recoveryStarted, [11] recoveryStartTimestamp, [12] inheritanceClaimsClosed.
  if (info[6] !== BigInt(wallets.length)) throw new Error("Heir count does not match the list");
  const reads: OwnerAssetReads = {
    balance,
    activityTimestamp: info[5],
    inheritanceStarted: info[8],
    inheritanceStartTimestamp: info[9],
    recoveryStarted: info[10],
    recoveryStartTimestamp: info[11],
    inheritanceClaimsClosed: info[12],
  };
  const list: HeirInfo[] = wallets.map((wallet, i) => {
    // getHeirInheritanceInfo (l. 411-428): percentage, released, hasReceived, potential, potentialRemaining.
    const [percentage, released, received, potential, potentialRemaining] = decodeFunctionResult({
      abi: wrapperAbi,
      functionName: "getHeirInheritanceInfo",
      data: data(results, b + 3 + i),
    });
    if (percentage !== pcts[i]) throw new Error("Heir share differs between reads");
    return { wallet, bps: percentage, released, received, potential, potentialRemaining };
  });
  return { owner, me, ticker: asset.ticker, blockTimestamp, params, reads, heirs: list };
}

export async function readDetail(client: PublicClient, asset: DeployedAsset, owner: Address, me: Address, heirs: readonly Address[]): Promise<HeirDetail> {
  const results = await client.readContract({ address: multicall3.address, abi: multicall3Abi, functionName: "aggregate3", args: [detailCalls(asset, owner, heirs)] });
  return decodeDetail(asset, owner, me, heirs, results);
}

/**
 * Overview: the detail of ALL the assets where the account is an heir, in ONE eth_call (aggregate3,
 * allowFailure: false) with a single block time. Each asset is interpreted with decodeDetail (the same
 * checks as the detail of one asset), so the list and the panel never contradict each other.
 */
export interface OverviewItem {
  asset: DeployedAsset;
  heirs: readonly Address[];
}

export interface HeirOverview {
  owner: Address;
  me: Address;
  blockTimestamp: bigint;
  details: HeirDetail[];
}

export function overviewCalls(items: readonly OverviewItem[], owner: Address): Call3[] {
  const time = call(multicall3.address, encodeFunctionData({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp" }));
  return [time, ...items.flatMap((it) => detailCalls(it.asset, owner, it.heirs).slice(1))];
}

export function decodeOverview(items: readonly OverviewItem[], owner: Address, me: Address, results: readonly CallResult[]): HeirOverview {
  const sizes = items.map((it) => PARAMS.length + 3 + it.heirs.length);
  const expected = 1 + sizes.reduce((s, n) => s + n, 0);
  if (results.length !== expected) throw new Error(`Multicall3 returned ${String(results.length)} results, expected ${String(expected)}`);
  const time = results[0];
  if (time === undefined) throw new Error("Missing block timestamp");
  let at = 1;
  const details = items.map((it, i) => {
    const n = sizes[i] ?? 0;
    const d = decodeDetail(it.asset, owner, me, it.heirs, [time, ...results.slice(at, at + n)]);
    at += n;
    return d;
  });
  const first = details[0];
  return { owner, me, blockTimestamp: first?.blockTimestamp ?? decodeFunctionResult({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp", data: data(results, 0) }), details };
}

export async function readOverview(client: PublicClient, items: readonly OverviewItem[], owner: Address, me: Address): Promise<HeirOverview> {
  const results = await client.readContract({ address: multicall3.address, abi: multicall3Abi, functionName: "aggregate3", args: [overviewCalls(items, owner)] });
  return decodeOverview(items, owner, me, results);
}
