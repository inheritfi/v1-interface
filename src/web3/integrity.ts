import { isAddress, isAddressEqual, keccak256, type Abi, type Address, type Hex, type PublicClient } from "viem";
import { decimalsAbi, underlyingGetterAbi, wrapperAbi } from "@deployment";
import { multicall3 } from "../contracts/generated/multicall3";
import type { DeployedAsset, Deployment } from "../contracts/types";
import { t } from "../i18n";

/** What was read from the chain for a wrapper. `null` = it could not be read. */
export interface WrapperObservation {
  ticker: string;
  hasCode: boolean;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  owner: Address | null;
  /** Only ERC-20 wrappers: address returned by the getter of the underlying and whether it has code. */
  underlying: Address | null;
  underlyingHasCode: boolean | null;
}

export interface Observation {
  chainId: number;
  /** keccak256 of the code at the Multicall3 address; null if there is no code. */
  multicall3Codehash: Hex | null;
  libraries: { name: string; hasCode: boolean }[];
  wrappers: WrapperObservation[];
}

export interface Finding {
  severity: "problem" | "warning";
  subject: string;
  detail: string;
}

/** Compares what was read with the manifest. Problem = the interface must not operate. Warning = it is shown, it does not block. */
export function evaluateIntegrity(d: Deployment, o: Observation): Finding[] {
  const out: Finding[] = [];
  const problem = (subject: string, detail: string) => out.push({ severity: "problem", subject, detail });
  if (o.chainId !== d.chainId) {
    problem(t("integrity.network"), t("integrity.wrongChain", { got: o.chainId, expected: d.chainId }));
    return out;
  }
  if (o.multicall3Codehash === null) {
    problem("Multicall3", t("integrity.noCodeAt", { address: multicall3.address }));
  } else if (o.multicall3Codehash !== multicall3.codehash) {
    problem("Multicall3", t("integrity.notMulticall3", { address: multicall3.address, codehash: o.multicall3Codehash }));
  }
  for (const lib of d.libraries) {
    const seen = o.libraries.find((l) => l.name === lib.name);
    if (seen?.hasCode !== true) problem(lib.name, t("integrity.noCode"));
  }
  for (const a of d.assets) {
    const w = o.wrappers.find((x) => x.ticker === a.ticker);
    if (!w?.hasCode) {
      problem(a.iToken.symbol, t("integrity.noCode"));
      continue;
    }
    checkWrapper(a, w, problem);
    if (w.owner === null) {
      problem(a.iToken.symbol, t("integrity.noOwner"));
    } else if (!isAddressEqual(w.owner, d.owner)) {
      out.push({ severity: "warning", subject: a.iToken.symbol, detail: t("integrity.otherOwner", { owner: w.owner, expected: d.owner }) });
    }
  }
  return out;
}

function checkWrapper(a: DeployedAsset, w: WrapperObservation, problem: (subject: string, detail: string) => void) {
  const s = a.iToken.symbol;
  if (w.symbol !== a.iToken.symbol) problem(s, t("integrity.symbol", { value: String(w.symbol) }));
  if (w.name !== a.iToken.name) problem(s, t("integrity.name", { value: String(w.name) }));
  if (w.decimals !== a.underlying.decimals) problem(s, t("integrity.decimals", { value: String(w.decimals), expected: a.underlying.decimals }));
  if (a.underlying.kind === "erc20") {
    if (w.underlying === null) {
      problem(s, t("integrity.noUnderlying", { expected: a.underlying.address }));
    } else if (!isAddressEqual(w.underlying, a.underlying.address)) {
      problem(s, t("integrity.otherUnderlying", { value: w.underlying, expected: a.underlying.address }));
    } else if (w.underlyingHasCode !== true) {
      problem(s, t("integrity.underlyingNoCode"));
    }
  }
}

const getters: Readonly<Record<string, Abi[number] | undefined>> = underlyingGetterAbi;

async function hasCode(client: PublicClient, address: Address): Promise<boolean> {
  const code = await client.getCode({ address });
  return code !== undefined && code !== "0x";
}

/** null if the read fails (missing contract, different function, etc.). */
async function attempt<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** Reads from the chain everything that is compared (including the code of Multicall3). Only reads (eth_chainId, eth_getCode, eth_call). */
export async function observeDeployment(client: PublicClient, d: Deployment): Promise<Observation> {
  const chainId = await client.getChainId();
  if (chainId !== d.chainId) {
    return { chainId, multicall3Codehash: null, libraries: [], wrappers: [] };
  }
  const mc3 = await client.getCode({ address: multicall3.address });
  const multicall3Codehash = mc3 === undefined || mc3 === "0x" ? null : keccak256(mc3);
  const libraries = await Promise.all(
    d.libraries.map(async (l) => ({ name: l.name, hasCode: await hasCode(client, l.address) })),
  );
  const wrappers = await Promise.all(d.assets.map((a) => observeWrapper(client, a)));
  return { chainId, multicall3Codehash, libraries, wrappers };
}

async function observeWrapper(client: PublicClient, a: DeployedAsset): Promise<WrapperObservation> {
  const address = a.address;
  const code = await hasCode(client, address);
  if (!code) {
    return { ticker: a.ticker, hasCode: false, symbol: null, name: null, decimals: null, owner: null, underlying: null, underlyingHasCode: null };
  }
  const [symbol, name, decimals, owner] = await Promise.all([
    attempt(() => client.readContract({ address, abi: wrapperAbi, functionName: "symbol" })),
    attempt(() => client.readContract({ address, abi: wrapperAbi, functionName: "name" })),
    attempt(() => client.readContract({ address, abi: decimalsAbi, functionName: "decimals" })),
    attempt(() => client.readContract({ address, abi: wrapperAbi, functionName: "owner" })),
  ]);
  let underlying: Address | null = null;
  let underlyingHasCode: boolean | null = null;
  const getter = getters[a.ticker];
  if (a.underlying.kind === "erc20" && getter !== undefined) {
    const getterAbi: Abi = [getter];
    const value: unknown = await attempt(() => client.readContract({ address, abi: getterAbi, functionName: a.ticker }));
    if (typeof value === "string" && isAddress(value, { strict: false })) {
      underlying = value;
      underlyingHasCode = await hasCode(client, value);
    }
  }
  return { ticker: a.ticker, hasCode: true, symbol, name, decimals, owner, underlying, underlyingHasCode };
}
