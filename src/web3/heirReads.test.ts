import { encodeFunctionResult, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { wrapperAbi } from "@deployment";
import { multicall3, multicall3Abi } from "../contracts/generated/multicall3";
import { decodeDetail, decodeOverview, decodeRoles, detailCalls, overviewCalls, rolesCalls } from "./heirReads";
import { deploymentInfo } from "./network";
import type { CallResult } from "./plan";

const OWNER: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const H2: Address = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const H3: Address = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const assets = deploymentInfo.assets;
const eth = assets[0];
const ok = (returnData: Hex): CallResult => ({ success: true, returnData });
const pad = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");

describe("rolesCalls / decodeRoles", () => {
  it("2 calls per asset (getHeirs and getRecoveryUsers of the owner), none can fail", () => {
    const calls = rolesCalls(assets, OWNER);
    expect(calls).toHaveLength(58);
    expect(new Set(calls.map((c) => c.allowFailure))).toEqual(new Set([false]));
    expect(calls[0]).toEqual({ target: eth?.address, allowFailure: false, callData: `0xb715ee05${pad(OWNER)}` });
    expect(calls[1]).toEqual({ target: eth?.address, allowFailure: false, callData: `0x4cd96f4d${pad(OWNER)}` });
  });

  it("detects heir (with its %), contact, both or none; compares case-insensitively", () => {
    const results: CallResult[] = assets.flatMap((a) =>
      a.ticker === "ETH"
        ? [ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", result: [[H2, H3], [5_000n, 5_000n]] })), ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", result: [H2] }))]
        : [ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", result: [[], []] })), ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", result: [] }))],
    );
    const r2 = decodeRoles(assets, OWNER, H2.toLowerCase() as Address, results);
    expect(r2.roles[0]).toEqual({ asset: eth, heirBps: 5_000n, isContact: true, heirs: [H2, H3] });
    expect(r2.roles.slice(1).every((x) => x.heirBps === null && !x.isContact)).toBe(true);
    const r3 = decodeRoles(assets, OWNER, H3, results);
    expect(r3.roles[0]?.heirBps).toBe(5_000n);
    expect(r3.roles[0]?.isContact).toBe(false);
    expect(() => decodeRoles(assets, OWNER, H2, results.slice(1))).toThrow(/expected 58/);
    const bad = [...results];
    bad[3] = { success: false, returnData: "0x" };
    expect(() => decodeRoles(assets, OWNER, H2, bad)).toThrow(/Read 3 failed/);
  });
});

describe("detailCalls / decodeDetail", () => {
  if (eth === undefined) throw new Error("no ETH");
  const heirs = [H2, H3];
  const userInfo = (count: bigint, started: boolean, closed = false) =>
    [0n, 0n, 0n, 0n, 0n, 1_790_000_000n, count, 1n, started, started ? 1_791_000_000n : 0n, false, 0n, closed] as const;
  const results = (over: { heirs?: readonly Address[]; count?: bigint; pct3?: bigint } = {}): CallResult[] => [
    ok(encodeFunctionResult({ abi: multicall3Abi, functionName: "getCurrentBlockTimestamp", result: 1_791_500_000n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "inheritInactivityPeriod", result: 2_592_000n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "inheritWaitingTime", result: 604_800n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "inheritRemainingWaitingTime", result: 1_209_600n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "recoveryExecutionWindow", result: 2_592_000n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "inheritanceTax", result: 30n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getUserInfo", result: userInfo(over.count ?? 2n, true) })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "balanceOf", result: 1_000n })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", result: [over.heirs ?? heirs, [5_000n, 5_000n]] })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirInheritanceInfo", result: [5_000n, 500n, true, 0n, 0n] })),
    ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirInheritanceInfo", result: [over.pct3 ?? 5_000n, 0n, false, 498n, 0n] })),
  ];

  it("time, 5 parameters, getUserInfo, balance, getHeirs and getHeirInheritanceInfo of each heir", () => {
    const calls = detailCalls(eth, OWNER, heirs);
    expect(calls).toHaveLength(1 + 5 + 3 + 2);
    expect(calls[0]?.target).toBe(multicall3.address);
    expect(calls.at(-1)?.callData).toBe(`0x${calls.at(-1)?.callData.slice(2, 10) ?? ""}${pad(OWNER)}${pad(H3)}`);
  });

  it("interprets the state and the information of each heir", () => {
    const d = decodeDetail(eth, OWNER, H3, heirs, results());
    expect(d.params).toEqual({ inheritInactivityPeriod: 2_592_000n, inheritWaitingTime: 604_800n, inheritRemainingWaitingTime: 1_209_600n, recoveryExecutionWindow: 2_592_000n, inheritanceTax: 30n });
    expect(d.reads.inheritanceStarted).toBe(true);
    expect(d.reads.balance).toBe(1_000n);
    expect(d.heirs).toEqual([
      { wallet: H2, bps: 5_000n, released: 500n, received: true, potential: 0n, potentialRemaining: 0n },
      { wallet: H3, bps: 5_000n, released: 0n, received: false, potential: 498n, potentialRemaining: 0n },
    ]);
  });

  it("rejects if the list changed between reads, if the counter or the percentage does not match", () => {
    expect(() => decodeDetail(eth, OWNER, H3, heirs, results({ heirs: [H3, H2] }))).toThrow(/changed between reads/);
    expect(() => decodeDetail(eth, OWNER, H3, heirs, results({ count: 3n }))).toThrow(/Heir count/);
    expect(() => decodeDetail(eth, OWNER, H3, heirs, results({ pct3: 4_000n }))).toThrow(/share differs/);
    expect(() => decodeDetail(eth, OWNER, H3, heirs, results().slice(1))).toThrow(/expected 11/);
  });

  it("rejects parameters that contradict the frozen code of the contracts (bounds.ts)", () => {
    const REJECT = /Value contradicts the deployed contracts/;
    const tax = results();
    tax[5] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "inheritanceTax", result: 31n }));
    expect(() => decodeDetail(eth, OWNER, H3, heirs, tax)).toThrow(REJECT);
    const waiting = results();
    waiting[2] = ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "inheritWaitingTime", result: 90n * 86_400n + 1n }));
    expect(() => decodeDetail(eth, OWNER, H3, heirs, waiting)).toThrow(REJECT);
  });

  it("overview: one time for all and each asset with the same checks as its detail", () => {
    const aave = assets[1];
    if (aave === undefined) throw new Error("no AAVE");
    const items = [
      { asset: eth, heirs },
      { asset: aave, heirs },
    ];
    const calls = overviewCalls(items, OWNER);
    expect(calls).toHaveLength(1 + 2 * (5 + 3 + 2));
    expect(calls[0]?.target).toBe(multicall3.address);
    expect(calls.slice(1, 11)).toEqual(detailCalls(eth, OWNER, heirs).slice(1));
    expect(calls.slice(11)).toEqual(detailCalls(aave, OWNER, heirs).slice(1));
    const one = results();
    const all = [...one, ...one.slice(1)];
    const o = decodeOverview(items, OWNER, H3, all);
    expect(o.blockTimestamp).toBe(1_791_500_000n);
    expect(o.details.map((d) => d.ticker)).toEqual(["ETH", aave.ticker]);
    expect(o.details[1]).toEqual({ ...decodeDetail(eth, OWNER, H3, heirs, one), ticker: aave.ticker });
    expect(() => decodeOverview(items, OWNER, H3, all.slice(1))).toThrow(/expected 21/);
    const bad = [...one, ...results({ count: 3n }).slice(1)];
    expect(() => decodeOverview(items, OWNER, H3, bad)).toThrow(/Heir count/);
    const t0 = one[0];
    if (t0 === undefined) throw new Error("no time");
    expect(decodeOverview([], OWNER, H3, [t0]).details).toEqual([]);
  });
});

describe("decodeRoles: rules of the frozen code of the contracts (bounds.ts)", () => {
  const REJECT = /Value contradicts the deployed contracts/;
  const roles = (heirs: readonly Address[], pcts: readonly bigint[], contacts: readonly Address[]): CallResult[] =>
    assets.flatMap((a) =>
      a.ticker === "ETH"
        ? [ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", result: [heirs, pcts] })), ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", result: contacts }))]
        : [ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getHeirs", result: [[], []] })), ok(encodeFunctionResult({ abi: wrapperAbi, functionName: "getRecoveryUsers", result: [] }))],
    );

  it("rejects percentages that do not sum 10 000, the owner as heir or repeated contacts", () => {
    expect(() => decodeRoles(assets, OWNER, H2, roles([H2, H3], [5_000n, 4_999n], []))).toThrow(REJECT);
    expect(() => decodeRoles(assets, OWNER, H2, roles([OWNER], [10_000n], []))).toThrow(REJECT);
    expect(() => decodeRoles(assets, OWNER, H2, roles([], [], [H2, H2]))).toThrow(REJECT);
    expect(decodeRoles(assets, OWNER, H2, roles([H2, H3], [5_000n, 5_000n], [H2])).roles[0]?.heirBps).toBe(5_000n);
  });
});
