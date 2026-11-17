import { multicall3Abi as viemMulticall3Abi, toFunctionSelector, type AbiFunction } from "viem";
import { describe, expect, it } from "vitest";
import { multicall3, multicall3Abi } from "../contracts/generated/multicall3";

/** Comparable shape of a function: name, mutability and types/names of inputs and outputs (without internalType). */
function shape(f: AbiFunction): unknown {
  const params = (ps: AbiFunction["inputs"]): unknown =>
    ps.map((p) => ({ name: p.name, type: p.type, components: "components" in p ? params(p.components) : null }));
  return { name: f.name, stateMutability: f.stateMutability, inputs: params(f.inputs), outputs: params(f.outputs) };
}

describe("Multicall3", () => {
  it("mainnet address and codehash", () => {
    expect(multicall3.address).toBe("0xcA11bde05977b3631167028862bE2a173976CA11");
    expect(multicall3.codehash).toBe("0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891");
  });

  it("only aggregate3 (declared view), getCurrentBlockTimestamp and getEthBalance, with their selectors", () => {
    expect(multicall3Abi.map((f) => [f.name, f.stateMutability, toFunctionSelector(f)])).toEqual([
      ["aggregate3", "view", "0x82ad56cb"],
      ["getCurrentBlockTimestamp", "view", "0x0f28c97d"],
      ["getEthBalance", "view", "0x4d2301cc"],
    ]);
  });

  it("matches viem's multicall3Abi in the functions we use", () => {
    for (const ours of multicall3Abi) {
      const theirs = viemMulticall3Abi.find((f) => f.name === ours.name);
      expect(theirs).toBeDefined();
      if (theirs === undefined) return;
      expect(shape(ours)).toEqual(shape(theirs));
    }
  });
});
