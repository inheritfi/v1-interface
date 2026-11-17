import { describe, expect, it } from "vitest";
import { deployment } from "@deployment";
import type { Deployment } from "../contracts/types";
import { multicall3 } from "../contracts/generated/multicall3";
import { evaluateIntegrity, type Observation } from "./integrity";

const d: Deployment = deployment;

/** What a chain with exactly the deployment of the manifest would return. */
function perfect(): Observation {
  return {
    chainId: d.chainId,
    multicall3Codehash: multicall3.codehash,
    libraries: d.libraries.map((l) => ({ name: l.name, hasCode: true })),
    wrappers: d.assets.map((a) => ({
      ticker: a.ticker,
      hasCode: true,
      symbol: a.iToken.symbol,
      name: a.iToken.name,
      decimals: a.underlying.decimals,
      owner: d.owner,
      underlying: a.underlying.kind === "erc20" ? a.underlying.address : null,
      underlyingHasCode: a.underlying.kind === "erc20" ? true : null,
    })),
  };
}

function wrapper(o: Observation, ticker: string) {
  const w = o.wrappers.find((x) => x.ticker === ticker);
  if (w === undefined) throw new Error(`missing ${ticker}`);
  return w;
}

describe("evaluateIntegrity", () => {
  it("finds nothing if the chain matches the manifest", () => {
    expect(evaluateIntegrity(d, perfect())).toEqual([]);
  });

  it("blocks if the node is on another chain and compares nothing else", () => {
    const f = evaluateIntegrity(d, { chainId: 11155111, multicall3Codehash: null, libraries: [], wrappers: [] });
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("problem");
    expect(f[0]?.subject).toBe("Network");
  });

  it("blocks if the code of a library or of a wrapper is missing", () => {
    const o = perfect();
    const lib = o.libraries[0];
    if (lib === undefined) throw new Error("no library");
    lib.hasCode = false;
    wrapper(o, "WBTC").hasCode = false;
    const f = evaluateIntegrity(d, o);
    expect(f.map((x) => x.subject)).toEqual(["InheritfiV1GovernanceLib", "iWBTC"]);
    expect(f.every((x) => x.severity === "problem")).toBe(true);
  });

  it("blocks if symbol, name, decimals or underlying do not match", () => {
    const o = perfect();
    wrapper(o, "DAI").symbol = "iDAl";
    wrapper(o, "LINK").name = "INHERITFI V1 LlNK";
    wrapper(o, "WBTC").decimals = 18;
    wrapper(o, "UNI").underlying = "0x0000000000000000000000000000000000000001";
    wrapper(o, "AAVE").underlyingHasCode = false;
    const f = evaluateIntegrity(d, o);
    expect(f.map((x) => `${x.severity}:${x.subject}`)).toEqual([
      "problem:iAAVE",
      "problem:iDAI",
      "problem:iLINK",
      "problem:iUNI",
      "problem:iWBTC",
    ]);
  });

  it("blocks if a read fails (null)", () => {
    const o = perfect();
    wrapper(o, "ETH").decimals = null;
    wrapper(o, "CRV").owner = null;
    expect(evaluateIntegrity(d, o).map((x) => `${x.severity}:${x.subject}`)).toEqual(["problem:iETH", "problem:iCRV"]);
  });

  it("only warns if the owner changed", () => {
    const o = perfect();
    wrapper(o, "ENS").owner = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const f = evaluateIntegrity(d, o);
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("warning");
    expect(f[0]?.subject).toBe("iENS");
  });

  it("compares addresses regardless of case", () => {
    const o = perfect();
    const w = wrapper(o, "DAI");
    if (w.underlying === null) throw new Error("no underlying");
    w.underlying = w.underlying.toLowerCase() as `0x${string}`;
    expect(evaluateIntegrity(d, o)).toEqual([]);
  });

  it("blocks if Multicall3 is missing or its code is not the verified one", () => {
    const missing = perfect();
    missing.multicall3Codehash = null;
    expect(evaluateIntegrity(d, missing).map((x) => `${x.severity}:${x.subject}`)).toEqual(["problem:Multicall3"]);
    const other = perfect();
    other.multicall3Codehash = "0x0000000000000000000000000000000000000000000000000000000000000001";
    expect(evaluateIntegrity(d, other).map((x) => `${x.severity}:${x.subject}`)).toEqual(["problem:Multicall3"]);
  });
});
