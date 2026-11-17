import { decodeFunctionResult, encodeFunctionData, isAddressEqual, type Address, type Hex, type PublicClient } from "viem";
import { wrapperAbi } from "@deployment";
import { erc20ReadAbi } from "../contracts/generated/erc20";
import { multicall3, multicall3Abi } from "../contracts/generated/multicall3";
import type { DeployedAsset } from "../contracts/types";
import { checkTax, checkTreasuries } from "./bounds";
import type { CallResult } from "./plan";

/**
 * "Wrap and unwrap" screen: everything is read with ONE single eth_call to Multicall3.aggregate3 (same block for everything),
 * like the plan screen (see plan.ts). No call can fail (allowFailure: false).
 */

export interface WrapRow {
  asset: DeployedAsset;
  /** Wrapped balance (iToken) of the account. */
  wrapped: bigint;
  /** In the wallet: ETH (for ETH) or the underlying token (ERC-20). */
  wallet: bigint;
  /** Current approval of the underlying to the wrapper (allowance(account, wrapper)); null for ETH. */
  allowance: bigint | null;
}

export interface WrapOverview {
  account: Address;
  /** Chosen asset: its fees and whether the account is a treasury of that asset. */
  ticker: string;
  rows: WrapRow[];
  wrappingTax: bigint;
  unwrappingTax: bigint;
  isTreasury: boolean;
}

interface Call3 {
  target: Address;
  allowFailure: false;
  callData: Hex;
}

const call = (target: Address, callData: Hex): Call3 => ({ target, allowFailure: false, callData });

/**
 * Calls in a fixed order: [0] ETH of the account's wallet; for each asset, balanceOf of the iToken and, if it is an ERC-20,
 * balanceOf and allowance(account, wrapper) of the underlying; at the end, wrappingTax, unwrappingTax and getTreasuries of the
 * chosen asset.
 */
export function wrapCalls(assets: readonly DeployedAsset[], selected: DeployedAsset, account: Address): Call3[] {
  const eth = call(multicall3.address, encodeFunctionData({ abi: multicall3Abi, functionName: "getEthBalance", args: [account] }));
  const perAsset = assets.flatMap((a) => {
    const own = call(a.address, encodeFunctionData({ abi: wrapperAbi, functionName: "balanceOf", args: [account] }));
    const u = a.underlying;
    if (u.kind !== "erc20") return [own];
    return [
      own,
      call(u.address, encodeFunctionData({ abi: erc20ReadAbi, functionName: "balanceOf", args: [account] })),
      call(u.address, encodeFunctionData({ abi: erc20ReadAbi, functionName: "allowance", args: [account, a.address] })),
    ];
  });
  const sel = [
    call(selected.address, encodeFunctionData({ abi: wrapperAbi, functionName: "wrappingTax" })),
    call(selected.address, encodeFunctionData({ abi: wrapperAbi, functionName: "unwrappingTax" })),
    call(selected.address, encodeFunctionData({ abi: wrapperAbi, functionName: "getTreasuries" })),
  ];
  return [eth, ...perAsset, ...sel];
}

/** Interprets what aggregate3 returned for the calls of `wrapCalls`. Throws if anything does not match. */
export function decodeWrap(
  assets: readonly DeployedAsset[],
  selected: DeployedAsset,
  account: Address,
  results: readonly CallResult[],
): WrapOverview {
  if (!assets.some((a) => a.ticker === selected.ticker)) throw new Error("The selected asset is not in the deployment");
  const expected = 1 + assets.reduce((n, a) => n + (a.underlying.kind === "erc20" ? 3 : 1), 0) + 3;
  if (results.length !== expected) {
    throw new Error(`Multicall3 returned ${String(results.length)} results, expected ${String(expected)}`);
  }
  const data = (i: number): Hex => {
    const r = results[i];
    if (r?.success !== true) throw new Error(`Read ${String(i)} failed`);
    return r.returnData;
  };

  const walletEth = decodeFunctionResult({ abi: multicall3Abi, functionName: "getEthBalance", data: data(0) });
  let i = 1;
  const rows: WrapRow[] = assets.map((asset) => {
    const wrapped = decodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", data: data(i++) });
    if (asset.underlying.kind !== "erc20") return { asset, wrapped, wallet: walletEth, allowance: null };
    const wallet = decodeFunctionResult({ abi: erc20ReadAbi, functionName: "balanceOf", data: data(i++) });
    const allowance = decodeFunctionResult({ abi: erc20ReadAbi, functionName: "allowance", data: data(i++) });
    return { asset, wrapped, wallet, allowance };
  });
  const tax = (functionName: "wrappingTax" | "unwrappingTax"): bigint => {
    const v: unknown = decodeFunctionResult({ abi: wrapperAbi, functionName, data: data(i++) });
    if (typeof v !== "bigint") throw new Error(`Unexpected value for ${functionName}`);
    // Rule of the frozen code of the contracts (bounds.ts): from 0 to 30 basis points.
    return checkTax(functionName, v);
  };
  const wrappingTax = tax("wrappingTax");
  const unwrappingTax = tax("unwrappingTax");
  const [treasuryWallets, treasuryPcts] = decodeFunctionResult({ abi: wrapperAbi, functionName: "getTreasuries", data: data(i++) });
  if (treasuryWallets.length !== treasuryPcts.length) {
    throw new Error("getTreasuries returned lists of different length");
  }
  checkTreasuries(selected.address, treasuryWallets, treasuryPcts);
  // The same as in plan.ts: getTreasuries returns exactly the wallets that pay no fee when unwrapping.
  const isTreasury = treasuryWallets.some((w) => isAddressEqual(w, account));
  return { account, ticker: selected.ticker, rows, wrappingTax, unwrappingTax, isTreasury };
}

/** A single eth_call (aggregate3) with everything the "Wrap and unwrap" screen needs. Read only. */
export async function readWrapOverview(
  client: PublicClient,
  assets: readonly DeployedAsset[],
  selected: DeployedAsset,
  account: Address,
): Promise<WrapOverview> {
  const results = await client.readContract({
    address: multicall3.address,
    abi: multicall3Abi,
    functionName: "aggregate3",
    args: [wrapCalls(assets, selected, account)],
  });
  return decodeWrap(assets, selected, account, results);
}

/** Assets with something in the wallet or wrapped first (in the order of the manifest) and then the rest. */
export function sortWrapRows(rows: readonly WrapRow[]): WrapRow[] {
  const used = rows.filter((r) => r.wrapped > 0n || r.wallet > 0n || (r.allowance ?? 0n) > 0n);
  const rest = rows.filter((r) => !(r.wrapped > 0n || r.wallet > 0n || (r.allowance ?? 0n) > 0n));
  return [...used, ...rest];
}
