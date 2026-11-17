import { decodeFunctionResult, encodeFunctionData, type Address, type Hex, type PublicClient } from "viem";
import { wrapperAbi } from "@deployment";
import { multicall3, multicall3Abi } from "../contracts/generated/multicall3";
import type { DeployedAsset } from "../contracts/types";
import type { ContactOwnerReads, ContactParams } from "../lib/contactStatus";
import { checkContacts, checkPeriod, checkPeriodRelations, checkTax } from "./bounds";
import type { CallResult } from "./plan";

/**
 * View of the recovery contact from the owner's address. The roles (in which assets the account is a
 * contact) come from readRoles (heirReads.ts). Then, in ONE eth_call (aggregate3, allowFailure: false) and with a
 * single block time, for each asset where it is a contact: 5 parameters (periods and fee, always read from the
 * contract), getUserInfo and balance of the owner, and getRecoveryUsers again (the account must still be in the list and the list
 * must match the counter of getUserInfo).
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

const PARAMS = ["recoveryInactivityPeriod", "recoveryWaitingTime", "recoveryExecutionWindow", "inheritInactivityPeriod", "recoveryTax"] as const;
/** Calls per asset: parameters, getUserInfo, balanceOf and getRecoveryUsers. */
const PER_ASSET = PARAMS.length + 3;

export interface ContactDetail {
  owner: Address;
  me: Address;
  ticker: string;
  blockTimestamp: bigint;
  params: ContactParams;
  reads: ContactOwnerReads;
  /** recoveryUserCount of getUserInfo (it is checked against the list when interpreting). */
  recoveryUserCount: bigint;
}

export interface ContactOverview {
  owner: Address;
  me: Address;
  blockTimestamp: bigint;
  details: ContactDetail[];
}

function assetCalls(asset: DeployedAsset, owner: Address): Call3[] {
  const w = asset.address;
  return [
    ...PARAMS.map((functionName) => call(w, encodeFunctionData({ abi: wrapperAbi, functionName }))),
    call(w, encodeFunctionData({ abi: wrapperAbi, functionName: "getUserInfo", args: [owner] })),
    call(w, encodeFunctionData({ abi: wrapperAbi, functionName: "balanceOf", args: [owner] })),
    call(w, encodeFunctionData({ abi: wrapperAbi, functionName: "getRecoveryUsers", args: [owner] })),
  ];
}

export function contactOverviewCalls(assets: readonly DeployedAsset[], owner: Address): Call3[] {
  const time = call(multicall3.address, encodeFunctionData({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp" }));
  return [time, ...assets.flatMap((a) => assetCalls(a, owner))];
}

function decodeAsset(asset: DeployedAsset, owner: Address, me: Address, blockTimestamp: bigint, results: readonly CallResult[]): ContactDetail {
  const p = PARAMS.map((functionName, k) => {
    const v: unknown = decodeFunctionResult({ abi: wrapperAbi, functionName, data: data(results, k) });
    if (typeof v !== "bigint") throw new Error(`Unexpected value for ${functionName}`);
    return v;
  });
  const at = (k: number) => {
    const v = p[k];
    if (v === undefined) throw new Error("Missing parameter");
    return v;
  };
  const params: ContactParams = {
    recoveryInactivityPeriod: at(0),
    recoveryWaitingTime: at(1),
    recoveryExecutionWindow: at(2),
    inheritInactivityPeriod: at(3),
    recoveryTax: at(4),
  };
  // Rules of the frozen code of the contracts (bounds.ts): a value that contradicts them is rejected.
  checkPeriod("recoveryInactivityPeriod", params.recoveryInactivityPeriod);
  checkPeriod("recoveryWaitingTime", params.recoveryWaitingTime);
  checkPeriod("recoveryExecutionWindow", params.recoveryExecutionWindow);
  checkPeriod("inheritInactivityPeriod", params.inheritInactivityPeriod);
  checkPeriodRelations(params);
  checkTax("recoveryTax", params.recoveryTax);
  const b = PARAMS.length;
  // getUserInfo (InheritfiV1Base.sol l. 388-405): [5] activityTimestamp, [6] heirCount, [7] recoveryUserCount,
  // [8] inheritanceStarted, [10] recoveryStarted, [11] recoveryStartTimestamp.
  const info = decodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", data: data(results, b) });
  const balance = decodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", data: data(results, b + 1) });
  const contacts = decodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", data: data(results, b + 2) });
  checkContacts(owner, contacts);
  const reads: ContactOwnerReads = {
    balance,
    activityTimestamp: info[5],
    heirCount: info[6],
    inheritanceStarted: info[8],
    recoveryStarted: info[10],
    recoveryStartTimestamp: info[11],
    contacts: [...contacts],
  };
  return { owner, me, ticker: asset.ticker, blockTimestamp, params, reads, recoveryUserCount: info[7] };
}

export function decodeContactOverview(assets: readonly DeployedAsset[], owner: Address, me: Address, results: readonly CallResult[]): ContactOverview {
  const expected = 1 + PER_ASSET * assets.length;
  if (results.length !== expected) throw new Error(`Multicall3 returned ${String(results.length)} results, expected ${String(expected)}`);
  const blockTimestamp = decodeFunctionResult({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp", data: data(results, 0) });
  if (blockTimestamp <= 0n) throw new Error("Invalid block timestamp");
  const details = assets.map((asset, i) => decodeAsset(asset, owner, me, blockTimestamp, results.slice(1 + PER_ASSET * i, 1 + PER_ASSET * (i + 1))));
  return { owner, me, blockTimestamp, details };
}

export async function readContactOverview(client: PublicClient, assets: readonly DeployedAsset[], owner: Address, me: Address): Promise<ContactOverview> {
  const results = await client.readContract({ address: multicall3.address, abi: multicall3Abi, functionName: "aggregate3", args: [contactOverviewCalls(assets, owner)] });
  return decodeContactOverview(assets, owner, me, results);
}
