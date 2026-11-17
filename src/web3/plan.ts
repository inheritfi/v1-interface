import { decodeFunctionResult, encodeFunctionData, isAddressEqual, type Address, type Hex, type PublicClient } from "viem";
import { wrapperAbi } from "@deployment";
import { erc20ReadAbi } from "../contracts/generated/erc20";
import { multicall3, multicall3Abi } from "../contracts/generated/multicall3";
import type { DeployedAsset } from "../contracts/types";
import type { PlanReads, ProtocolParams } from "../lib/plan";
import { checkContacts, checkHeirs, checkMaxHeirs, checkMaxRecoveryUsers, checkPeriod, checkPeriodRelations, checkTax, checkTreasuries } from "./bounds";

/**
 * INHERITFI: everything that the owner screen shows is read with ONE single eth_call to Multicall3.aggregate3
 * (encoded here, without viem's multicall action, which splits the calls in batches of 1024 bytes). That way all the
 * reads are from the same block, including its time (getCurrentBlockTimestamp). No call can fail
 * (allowFailure: false): if one reverts, everything reverts and nothing is shown.
 */

export interface AssetOverview {
  asset: DeployedAsset;
  balance: bigint;
  /** It has heirs or contacts configured. */
  hasPlan: boolean;
  /** getUserInfo of the same asset: last activity and processes in progress ("Confirm I'm active in all", src/lib/confirmAll.ts). */
  activityTimestamp: bigint;
  inheritanceStarted: boolean;
  recoveryStarted: boolean;
}

export interface Snapshot {
  /** Account and asset for which it was read (the screen only shows the plan if they match the chosen ones). */
  account: Address;
  ticker: string;
  /** Time of the block in which all the reads were made. */
  blockTimestamp: bigint;
  /** ETH in the account's wallet (Multicall3.getEthBalance), in wei, in the same block. */
  walletEth: bigint;
  /** The account is a treasury wallet of the chosen asset (getTreasuries): it pays no fee when unwrapping. */
  isTreasury: boolean;
  /** Only if the chosen asset is an ERC-20: balance of the underlying in the wallet and current approval to the wrapper. */
  underlying: { wallet: bigint; allowance: bigint } | null;
  params: ProtocolParams;
  plan: PlanReads;
  overview: AssetOverview[];
}

interface Call3 {
  target: Address;
  allowFailure: false;
  callData: Hex;
}

export const PARAM_FUNCTIONS = [
  "recoveryInactivityPeriod",
  "inheritInactivityPeriod",
  "inheritWaitingTime",
  "inheritRemainingWaitingTime",
  "recoveryWaitingTime",
  "recoveryExecutionWindow",
  "wrappingTax",
  "unwrappingTax",
  "inheritanceTax",
  "recoveryTax",
  "maxHeirs",
  "maxRecoveryUsers",
] as const;

type ParamFunction = (typeof PARAM_FUNCTIONS)[number];

const call = (target: Address, callData: Hex): Call3 => ({ target, allowFailure: false, callData });

/**
 * Calls in a fixed order: [0] block time; [1..12] parameters of the chosen asset; [13..16] balance, getUserInfo,
 * heirs and contacts of the chosen asset; then balance and getUserInfo of each asset (summary); the ETH of the account's
 * wallet; getTreasuries of the chosen asset; and, if it is an ERC-20, balance of the underlying in the wallet and its
 * current approval to the wrapper (allowance(account, wrapper)).
 */
export function snapshotCalls(assets: readonly DeployedAsset[], selected: DeployedAsset, account: Address): Call3[] {
  const time = call(multicall3.address, encodeFunctionData({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp" }));
  const params = PARAM_FUNCTIONS.map((functionName) => call(selected.address, encodeFunctionData({ abi: wrapperAbi, functionName })));
  const plan = [
    call(selected.address, encodeFunctionData({ abi: wrapperAbi, functionName: "balanceOf", args: [account] })),
    call(selected.address, encodeFunctionData({ abi: wrapperAbi, functionName: "getUserInfo", args: [account] })),
    call(selected.address, encodeFunctionData({ abi: wrapperAbi, functionName: "getHeirs", args: [account] })),
    call(selected.address, encodeFunctionData({ abi: wrapperAbi, functionName: "getRecoveryUsers", args: [account] })),
  ];
  const overview = assets.flatMap((a) => [
    call(a.address, encodeFunctionData({ abi: wrapperAbi, functionName: "balanceOf", args: [account] })),
    call(a.address, encodeFunctionData({ abi: wrapperAbi, functionName: "getUserInfo", args: [account] })),
  ]);
  const ethBalance = call(multicall3.address, encodeFunctionData({ abi: multicall3Abi, functionName: "getEthBalance", args: [account] }));
  const treasuries = call(selected.address, encodeFunctionData({ abi: wrapperAbi, functionName: "getTreasuries" }));
  const u = selected.underlying;
  const underlying =
    u.kind === "erc20"
      ? [
          call(u.address, encodeFunctionData({ abi: erc20ReadAbi, functionName: "balanceOf", args: [account] })),
          call(u.address, encodeFunctionData({ abi: erc20ReadAbi, functionName: "allowance", args: [account, selected.address] })),
        ]
      : [];
  return [time, ...params, ...plan, ...overview, ethBalance, treasuries, ...underlying];
}

export interface CallResult {
  success: boolean;
  returnData: Hex;
}

/** Interprets what aggregate3 returned for the calls of `snapshotCalls`. Throws if anything does not match. */
export function decodeSnapshot(
  assets: readonly DeployedAsset[],
  selected: DeployedAsset,
  account: Address,
  results: readonly CallResult[],
): Snapshot {
  const isErc20 = selected.underlying.kind === "erc20";
  const tail = 1 + PARAM_FUNCTIONS.length + 4 + 2 * assets.length;
  const expected = tail + 2 + (isErc20 ? 2 : 0);
  if (results.length !== expected) {
    throw new Error(`Multicall3 returned ${String(results.length)} results, expected ${String(expected)}`);
  }
  const data = (i: number): Hex => {
    const r = results[i];
    if (r?.success !== true) throw new Error(`Read ${String(i)} failed`);
    return r.returnData;
  };

  const blockTimestamp = decodeFunctionResult({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp", data: data(0) });
  if (blockTimestamp <= 0n) throw new Error("Invalid block timestamp");

  const param = (k: number, functionName: ParamFunction): bigint => {
    const v: unknown = decodeFunctionResult({ abi: wrapperAbi, functionName, data: data(1 + k) });
    if (typeof v !== "bigint") throw new Error(`Unexpected value for ${functionName}`);
    return v;
  };
  const p = PARAM_FUNCTIONS.map((fn, k) => param(k, fn));
  const at = (k: number): bigint => {
    const v = p[k];
    if (v === undefined) throw new Error("Missing parameter");
    return v;
  };
  const params: ProtocolParams = {
    recoveryInactivityPeriod: at(0),
    inheritInactivityPeriod: at(1),
    inheritWaitingTime: at(2),
    inheritRemainingWaitingTime: at(3),
    recoveryWaitingTime: at(4),
    recoveryExecutionWindow: at(5),
    wrappingTax: at(6),
    unwrappingTax: at(7),
    inheritanceTax: at(8),
    recoveryTax: at(9),
    maxHeirs: at(10),
    maxRecoveryUsers: at(11),
  };
  // Rules of the frozen code of the contracts (bounds.ts): a value that contradicts them is rejected.
  checkPeriod("recoveryInactivityPeriod", params.recoveryInactivityPeriod);
  checkPeriod("inheritInactivityPeriod", params.inheritInactivityPeriod);
  checkPeriod("inheritWaitingTime", params.inheritWaitingTime);
  checkPeriod("inheritRemainingWaitingTime", params.inheritRemainingWaitingTime);
  checkPeriod("recoveryWaitingTime", params.recoveryWaitingTime);
  checkPeriod("recoveryExecutionWindow", params.recoveryExecutionWindow);
  checkPeriodRelations(params);
  checkTax("wrappingTax", params.wrappingTax);
  checkTax("unwrappingTax", params.unwrappingTax);
  checkTax("inheritanceTax", params.inheritanceTax);
  checkTax("recoveryTax", params.recoveryTax);
  checkMaxHeirs(params.maxHeirs);
  checkMaxRecoveryUsers(params.maxRecoveryUsers);

  const base = 1 + PARAM_FUNCTIONS.length;
  const balance = decodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", data: data(base) });
  const info = decodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", data: data(base + 1) });
  const [wallets, pcts] = decodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", data: data(base + 2) });
  const recoveryUsers = decodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", data: data(base + 3) });
  if (wallets.length !== pcts.length) {
    throw new Error("getHeirs returned lists of different length");
  }
  // getUserInfo (InheritfiV1Base.sol l. 388-405): totalReceived, totalSent, totalRecoveryRelease,
  // totalInheritanceRelease, totalInheritanceRemainingRelease, activityTimestamp, heirCount, recoveryUserCount,
  // inheritanceStarted, inheritanceStartTimestamp, recoveryStarted, recoveryStartTimestamp, inheritanceClaimsClosed.
  const [, , , , , activityTimestamp, heirCount, recoveryUserCount, inheritanceStarted, inheritanceStartTimestamp, recoveryStarted, recoveryStartTimestamp, inheritanceClaimsClosed] =
    info;
  if (heirCount !== BigInt(wallets.length) || recoveryUserCount !== BigInt(recoveryUsers.length)) {
    throw new Error("Heir or contact count does not match the lists");
  }
  checkHeirs(account, wallets, pcts);
  checkContacts(account, recoveryUsers);
  const plan: PlanReads = {
    balance,
    activityTimestamp,
    inheritanceStarted,
    inheritanceStartTimestamp,
    recoveryStarted,
    recoveryStartTimestamp,
    inheritanceClaimsClosed,
    heirs: wallets.map((wallet, i) => ({ wallet, bps: pcts[i] ?? 0n })),
    recoveryUsers: [...recoveryUsers],
  };

  const ov = base + 4;
  const overview = assets.map((asset, i) => {
    const b = decodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", data: data(ov + 2 * i) });
    const u = decodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", data: data(ov + 2 * i + 1) });
    return { asset, balance: b, hasPlan: u[6] > 0n || u[7] > 0n, activityTimestamp: u[5], inheritanceStarted: u[8], recoveryStarted: u[10] };
  });
  const own = overview.find((o) => o.asset.ticker === selected.ticker);
  if (own?.balance !== balance) {
    throw new Error("The selected asset's balance differs between reads");
  }

  const walletEth = decodeFunctionResult({ abi: multicall3Abi, functionName: "getEthBalance", data: data(tail) });
  const [treasuryWallets, treasuryPcts] = decodeFunctionResult({ abi: wrapperAbi, functionName: "getTreasuries", data: data(tail + 1) });
  if (treasuryWallets.length !== treasuryPcts.length) {
    throw new Error("getTreasuries returned lists of different length");
  }
  checkTreasuries(selected.address, treasuryWallets, treasuryPcts);
  // getTreasuries returns exactly the wallets with treasuryWallet = true (InheritfiV1GovernanceLib: setTreasuries and
  // acceptTreasuryWalletChange update the list and the mark at the same time), which are those that pay no fee when unwrapping.
  const isTreasury = treasuryWallets.some((w) => isAddressEqual(w, account));
  const underlying = isErc20
    ? {
        wallet: decodeFunctionResult({ abi: erc20ReadAbi, functionName: "balanceOf", data: data(tail + 2) }),
        allowance: decodeFunctionResult({ abi: erc20ReadAbi, functionName: "allowance", data: data(tail + 3) }),
      }
    : null;

  return { account, ticker: selected.ticker, blockTimestamp, walletEth, isTreasury, underlying, params, plan, overview };
}

/** A single eth_call (aggregate3) with everything the owner screen needs. Read only. */
export async function readSnapshot(
  client: PublicClient,
  assets: readonly DeployedAsset[],
  selected: DeployedAsset,
  account: Address,
): Promise<Snapshot> {
  const calls = snapshotCalls(assets, selected, account);
  const results = await client.readContract({
    address: multicall3.address,
    abi: multicall3Abi,
    functionName: "aggregate3",
    args: [calls],
  });
  return decodeSnapshot(assets, selected, account, results);
}

/** Assets with balance or a plan first (in the order of the manifest) and then the rest. */
export function sortOverview(rows: readonly AssetOverview[]): AssetOverview[] {
  const used = rows.filter((r) => r.balance > 0n || r.hasPlan);
  const rest = rows.filter((r) => !(r.balance > 0n || r.hasPlan));
  return [...used, ...rest];
}
