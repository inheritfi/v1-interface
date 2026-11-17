import { encodeFunctionResult, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { wrapperAbi } from "@deployment";
import { multicall3, multicall3Abi } from "../contracts/generated/multicall3";
import { contactOverviewCalls, decodeContactOverview } from "./contactReads";
import { deploymentInfo } from "./network";
import type { CallResult } from "./plan";

const OWNER: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const C2: Address = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const assets = deploymentInfo.assets;
const eth = assets[0];
const aave = assets[1];
const ok = (returnData: `0x${string}`): CallResult => ({ success: true, returnData });
const pad = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");

describe("contactOverviewCalls / decodeContactOverview", () => {
  if (eth === undefined || aave === undefined) throw new Error("no assets");
  const info = [0n, 0n, 0n, 0n, 0n, 1_790_000_000n, 2n, 1n, false, 0n, true, 1_791_000_000n, false] as const;
  const one = (over: { balance?: bigint } = {}): CallResult[] => [
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "recoveryInactivityPeriod", result: 1_296_000n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "recoveryWaitingTime", result: 604_800n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "recoveryExecutionWindow", result: 2_592_000n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "inheritInactivityPeriod", result: 2_592_000n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "recoveryTax", result: 30n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", result: info })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", result: over.balance ?? 1_000n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", result: [C2] })),
  ];
  const time = ok(encodeFunctionResult({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp", result: 1_791_500_000n }));

  it("one time and 8 calls per asset (5 parameters, getUserInfo, balance and getRecoveryUsers), none can fail", () => {
    const calls = contactOverviewCalls([eth, aave], OWNER);
    expect(calls).toHaveLength(1 + 2 * 8);
    expect(calls[0]?.target).toBe(multicall3.address);
    expect(new Set(calls.map((c) => c.allowFailure))).toEqual(new Set([false]));
    expect(calls.slice(1, 9).every((c) => c.target === eth.address)).toBe(true);
    expect(calls.slice(9).every((c) => c.target === aave.address)).toBe(true);
    expect(calls[8]).toEqual({ target: eth.address, allowFailure: false, callData: `0x4cd96f4d${pad(OWNER)}` });
  });

  it("interprets parameters, state and list of each asset", () => {
    const o = decodeContactOverview([eth, aave], OWNER, C2, [time, ...one(), ...one({ balance: 0n })]);
    expect(o.blockTimestamp).toBe(1_791_500_000n);
    expect(o.details.map((d) => d.ticker)).toEqual(["ETH", aave.ticker]);
    expect(o.details[0]).toEqual({
      owner: OWNER,
      me: C2,
      ticker: "ETH",
      blockTimestamp: 1_791_500_000n,
      params: { recoveryInactivityPeriod: 1_296_000n, recoveryWaitingTime: 604_800n, recoveryExecutionWindow: 2_592_000n, inheritInactivityPeriod: 2_592_000n, recoveryTax: 30n },
      reads: { balance: 1_000n, activityTimestamp: 1_790_000_000n, heirCount: 2n, inheritanceStarted: false, recoveryStarted: true, recoveryStartTimestamp: 1_791_000_000n, contacts: [C2] },
      recoveryUserCount: 1n,
    });
    expect(o.details[1]?.reads.balance).toBe(0n);
  });

  it("rejects a different number of results or a failed read", () => {
    expect(() => decodeContactOverview([eth, aave], OWNER, C2, [time, ...one()])).toThrow(/expected 17/);
    const bad = [time, ...one()];
    bad[6] = { success: false, returnData: "0x" };
    expect(() => decodeContactOverview([eth], OWNER, C2, bad)).toThrow(/Read 5 failed/);
  });

  it("rejects periods, relations, fees or contacts that contradict the frozen code of the contracts (bounds.ts)", () => {
    const REJECT = /Value contradicts the deployed contracts/;
    const window = one();
    window[2] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "recoveryExecutionWindow", result: 604_800n + 3n * 86_400n - 1n }));
    expect(() => decodeContactOverview([eth], OWNER, C2, [time, ...window])).toThrow(REJECT);
    const tax = one();
    tax[4] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "recoveryTax", result: 31n }));
    expect(() => decodeContactOverview([eth], OWNER, C2, [time, ...tax])).toThrow(REJECT);
    const contacts = one();
    contacts[7] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", result: [OWNER] }));
    expect(() => decodeContactOverview([eth], OWNER, C2, [time, ...contacts])).toThrow(REJECT);
  });
});
