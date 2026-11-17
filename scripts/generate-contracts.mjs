// @ts-check
/**
 * INHERITFI: generates the contract types from the manifest of each environment and from Multicall3.
 *
 * Reads contracts/<environment>/manifest.<environment>.json and its ABIs, verifies everything (pinned SHA-256 of the manifest,
 * SHA-256 of each ABI, schema, chainId, checksummed addresses, pattern of the wrapper ABIs) and writes
 * src/contracts/generated/<environment>.ts with `as const`. If anything does not match, it aborts without writing anything.
 *
 * Multicall3 (contracts/multicall3/, the same in every environment): verifies the pinned SHA-256 of multicall3.json and
 * of its files, that the keccak of the code deployed on mainnet is the pinned codehash and that the selectors of
 * all the functions of the ABI (compiled from the official source, referenced in multicall3.json) are in that code; writes
 * src/contracts/generated/multicall3.ts with only aggregate3 (declared view on purpose), getCurrentBlockTimestamp and
 * getEthBalance.
 *
 * IERC20 (contracts/erc20/, ABI from the Forge artifact of OpenZeppelin 5.7.0, the same for the 28 underlyings): verifies
 * the pinned SHA-256 of erc20.json and that of the ABI, that it contains exactly the 6 IERC20 functions with their signatures and
 * selectors, and writes src/contracts/generated/erc20.ts with balanceOf and allowance, and approve WITHOUT outputs (on purpose:
 * the interface does not decode what approve returns; it checks the approval by reading it afterwards).
 *
 *   node scripts/generate-contracts.mjs            generates every environment present
 *   node scripts/generate-contracts.mjs --check    only checks that the generated files are up to date
 *
 * No new dependencies: only Node and `viem` (already installed) for the EIP-55 checksum, keccak and selectors.
 */
import { Buffer } from "node:buffer";
import console from "node:console";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getAddress, keccak256, toFunctionSelector } from "viem";

export const SCHEMA = "inheritfi-manifest/2";
export const ENVS = /** @type {const} */ (["mainnet"]);
export const LIB_NAMES = /** @type {const} */ (["InheritfiV1GovernanceLib", "InheritfiV1InheritanceLib"]);
export const N_ASSETS = 29;

/** @typedef {(typeof ENVS)[number]} Env */
/** @typedef {Record<string, unknown>} Obj */

export class GenerateError extends Error {}

/** @param {string} msg @returns {never} */
function fail(msg) {
  throw new GenerateError(msg);
}

/** @param {unknown} v @param {string} what @returns {Obj} */
function obj(v, what) {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${what}: expected an object`);
  return /** @type {Obj} */ (v);
}

/** @param {unknown} v @param {string} what @returns {unknown[]} */
function arr(v, what) {
  if (!Array.isArray(v)) fail(`${what}: expected a list`);
  return /** @type {unknown[]} */ (v);
}

/** @param {unknown} v @param {string} what @returns {string} */
function str(v, what) {
  if (typeof v !== "string" || v === "") fail(`${what}: expected a text`);
  return v;
}

/** @param {unknown} v @param {string} what @param {number} min @param {number} max @returns {number} */
function int(v, what, min, max) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max) fail(`${what}: integer out of range`);
  return v;
}

/** @param {unknown} v @param {string} what @returns {`0x${string}`} */
function checksummed(v, what) {
  const s = str(v, what);
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) fail(`${what}: not an address`);
  if (getAddress(s) !== s) fail(`${what}: the address is not in EIP-55 checksum format`);
  if (/^0x0{40}$/.test(s)) fail(`${what}: zero address`);
  return /** @type {`0x${string}`} */ (s);
}

/** @param {unknown} v @param {string} what @returns {string} */
function sha256Hex(v, what) {
  const s = str(v, what);
  if (!/^[0-9a-f]{64}$/.test(s)) fail(`${what}: malformed SHA-256`);
  return s;
}

/** @param {Uint8Array} buf */
export function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/** Canonical form of an ABI entry (sorted keys) for comparison. @param {unknown} v @returns {string} */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (typeof v === "object" && v !== null) {
    const o = /** @type {Obj} */ (v);
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** @param {string} name @param {string} [inName] */
function u256Out(name = "", inName = "") {
  return { name: inName || name, type: "uint256", internalType: "uint256" };
}

/**
 * Entries specific to each wrapper (what is not common to the 29). They are compared in canonical form.
 * The name of the constructor parameter is not compared (it changes per asset and is not part of the interface).
 * @param {string} ticker
 * @param {"native" | "erc20"} kind
 * @param {"view" | "pure"} decimalsMutability
 */
export function expectedSpecific(ticker, kind, decimalsMutability) {
  const decimals = {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: decimalsMutability,
  };
  if (kind === "native") {
    return [
      { type: "constructor", inputs: [], stateMutability: "nonpayable" },
      decimals,
      { type: "function", name: "getRecoverableETH", inputs: [], outputs: [u256Out()], stateMutability: "view" },
      {
        type: "function",
        name: "getRecoveryInfo",
        inputs: [],
        outputs: [
          u256Out("totalETH"),
          u256Out("totalIETHSupply"),
          u256Out("recoverableETH"),
          u256Out("ethBackingRatio"),
        ],
        stateMutability: "view",
      },
      { type: "function", name: "wrap", inputs: [], outputs: [], stateMutability: "payable" },
    ];
  }
  return [
    { type: "constructor", inputs: [{ name: "*", type: "address", internalType: "address" }], stateMutability: "nonpayable" },
    {
      type: "function",
      name: ticker,
      inputs: [],
      outputs: [{ name: "", type: "address", internalType: "contract IERC20" }],
      stateMutability: "view",
    },
    decimals,
    {
      type: "function",
      name: `emergencyRecover${ticker}`,
      inputs: [
        { name: "to", type: "address", internalType: "address" },
        { name: "amount", type: "uint256", internalType: "uint256" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
    { type: "function", name: `getRecoverable${ticker}`, inputs: [], outputs: [u256Out()], stateMutability: "view" },
    {
      type: "function",
      name: "wrap",
      inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
      outputs: [],
      stateMutability: "nonpayable",
    },
  ];
}

/** The name of the constructor parameter is replaced with "*" to compare it. @param {unknown} e */
function forCompare(e) {
  const o = obj(e, "ABI entry");
  if (o.type !== "constructor") return canonical(o);
  const inputs = arr(o.inputs, "constructor.inputs").map((i) => ({ ...obj(i, "constructor.inputs[]"), name: "*" }));
  return canonical({ ...o, inputs });
}

/**
 * Reads and verifies an environment. Writes nothing.
 * @param {string} root repository folder
 * @param {Env} env
 */
export function load(root, env) {
  const dir = join(root, "contracts", env);
  const mpath = join(dir, `manifest.${env}.json`);
  const pins = obj(JSON.parse(readFileSync(join(root, "contracts", "pins.json"), "utf8")), "pins.json");
  const pin = sha256Hex(pins[env], `pins.json[${env}]`);
  const mbuf = readFileSync(mpath);
  const msha = sha256(mbuf);
  if (msha !== pin) fail(`${env}: the SHA-256 of the manifest (${msha}) is not the one pinned in pins.json (${pin})`);

  const m = obj(JSON.parse(mbuf.toString("utf8")), "manifest");
  if (m.schema !== SCHEMA) fail(`${env}: schema ${String(m.schema)}, expected ${SCHEMA}`);
  if (m.env !== env) fail(`${env}: the manifest says env=${String(m.env)}`);
  const chainId = int(m.chainId, "chainId", 1, 2 ** 31);
  if (chainId !== 1) fail(`${env}: chainId ${String(chainId)} not allowed`);
  const owner = checksummed(m.owner, "owner");
  const dep = obj(m.deployment, "deployment");
  const startBlock = int(dep.startBlock, "deployment.startBlock", 1, Number.MAX_SAFE_INTEGER);

  const abiDir = join(dir, "abi");
  /** @type {Set<string>} */
  const referenced = new Set();
  /** @param {unknown} ref @param {string} contract @returns {unknown[]} */
  const readAbi = (ref, contract) => {
    const r = obj(ref, `${contract}.abi`);
    const file = str(r.file, `${contract}.abi.file`);
    if (file !== `abi/${contract}.json`) fail(`${contract}: unexpected ABI path ${file}`);
    const p = join(dir, file);
    if (!existsSync(p) || !lstatSync(p).isFile()) fail(`${contract}: ${file} is missing or is not a regular file`);
    const buf = readFileSync(p);
    if (sha256(buf) !== sha256Hex(r.sha256, `${contract}.abi.sha256`)) fail(`${contract}: the SHA-256 of ${file} does not match`);
    referenced.add(`${contract}.json`);
    return arr(JSON.parse(buf.toString("utf8")), `${contract}: ABI`);
  };

  const libsRaw = arr(m.libraries, "libraries");
  if (libsRaw.length !== LIB_NAMES.length) fail(`${env}: expected ${String(LIB_NAMES.length)} libraries`);
  const libraries = LIB_NAMES.map((name, i) => {
    const l = obj(libsRaw[i], `libraries[${String(i)}]`);
    if (l.name !== name) fail(`${env}: library ${String(i)} is ${String(l.name)}, expected ${name}`);
    readAbi(l.abi, name);
    return { name, address: checksummed(l.address, `${name}.address`) };
  });

  const assetsRaw = arr(m.assets, "assets");
  if (assetsRaw.length !== N_ASSETS) fail(`${env}: expected ${String(N_ASSETS)} assets`);
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Set<string>} */
  const addresses = new Set();
  /** @param {string} a */
  const unique = (a) => {
    if (addresses.has(a.toLowerCase())) fail(`${env}: repeated address ${a}`);
    addresses.add(a.toLowerCase());
  };
  [owner, ...libraries.map((l) => l.address)].forEach(unique);

  /** @type {Map<string, unknown[]>} */
  const abis = new Map();
  const assets = assetsRaw.map((raw, i) => {
    const a = obj(raw, `assets[${String(i)}]`);
    const ticker = str(a.ticker, `assets[${String(i)}].ticker`);
    if (!/^[A-Za-z0-9]{1,16}$/.test(ticker) || seen.has(ticker)) fail(`${env}: invalid or repeated ticker ${ticker}`);
    seen.add(ticker);
    const w = obj(a.wrapper, `${ticker}.wrapper`);
    const contract = `InheritfiV1${ticker}`;
    if (w.contract !== contract) fail(`${ticker}: contract ${String(w.contract)}, expected ${contract}`);
    const address = checksummed(w.address, `${ticker}.wrapper.address`);
    unique(address);
    const it = obj(a.iToken, `${ticker}.iToken`);
    if (it.symbol !== `i${ticker}` || it.name !== `INHERITFI V1 ${ticker}`) fail(`${ticker}: unexpected iToken name or symbol`);
    const u = obj(a.underlying, `${ticker}.underlying`);
    const decimals = int(u.decimals, `${ticker}.underlying.decimals`, 0, 255);
    /** @type {{ kind: "native"; decimals: number } | { kind: "erc20"; address: `0x${string}`; symbol: string; decimals: number }} */
    let underlying;
    if (u.kind === "native") {
      if (i !== 0 || ticker !== "ETH" || decimals !== 18) fail(`${ticker}: only ETH (the first one, 18 decimals) can be native`);
      underlying = { kind: "native", decimals };
    } else if (u.kind === "erc20") {
      if (i === 0) fail(`${env}: the first asset must be native ETH`);
      const ua = checksummed(u.address, `${ticker}.underlying.address`);
      unique(ua);
      if (u.symbol !== ticker) fail(`${ticker}: underlying symbol ${String(u.symbol)} differs from the ticker`);
      underlying = { kind: "erc20", address: ua, symbol: ticker, decimals };
    } else {
      fail(`${ticker}: unknown underlying kind`);
    }
    abis.set(ticker, readAbi(w.abi, contract));
    return { ticker, contract, address, iToken: { name: `INHERITFI V1 ${ticker}`, symbol: `i${ticker}` }, underlying };
  });

  const files = readdirSync(abiDir);
  for (const f of files) {
    if (!referenced.has(f)) fail(`${env}: abi/${f} is not in the manifest`);
  }
  const extra = readdirSync(dir).filter((f) => f !== "abi" && f !== `manifest.${env}.json`);
  if (extra.length > 0) fail(`${env}: unexpected files in contracts/${env}: ${extra.join(", ")}`);

  // ABI pattern: a common part identical in the 29 and, in each one, only its own expected entries.
  const first = abis.get("ETH") ?? fail("ETH is missing");
  /** @param {string} ticker @param {"native" | "erc20"} kind */
  const specificFor = (ticker, kind) => {
    const abi = abis.get(ticker) ?? fail(`${ticker} is missing`);
    const dec = abi.map((e) => obj(e, "entry")).find((e) => e.type === "function" && e.name === "decimals");
    const mut = dec?.stateMutability === "pure" ? "pure" : "view";
    return new Set(expectedSpecific(ticker, kind, mut).map(forCompare));
  };
  const ethSpecific = specificFor("ETH", "native");
  const common = first.filter((e) => !ethSpecific.has(forCompare(e)));
  const commonKeys = new Set(common.map(forCompare));
  if (commonKeys.size !== common.length) fail(`${env}: repeated entries in the ETH ABI`);
  for (const a of assets) {
    const abi = abis.get(a.ticker) ?? fail(`${a.ticker} is missing`);
    const keys = abi.map(forCompare);
    if (new Set(keys).size !== keys.length) fail(`${a.contract}: repeated entries in the ABI`);
    const spec = specificFor(a.ticker, a.underlying.kind);
    const want = new Set([...commonKeys, ...spec]);
    const got = new Set(keys);
    const missing = [...want].filter((k) => !got.has(k));
    const unexpected = [...got].filter((k) => !want.has(k));
    if (missing.length > 0 || unexpected.length > 0) {
      fail(`${a.contract}: the ABI does not follow the pattern (${String(missing.length)} missing, ${String(unexpected.length)} extra)`);
    }
  }

  /** @param {string} ticker @param {(e: Obj) => boolean} pick @returns {Obj} */
  const entry = (ticker, pick) => {
    const found = (abis.get(ticker) ?? []).map((e) => obj(e, "entry")).filter(pick);
    if (found.length !== 1) fail(`${ticker}: expected entry not found exactly once`);
    return /** @type {Obj} */ (found[0]);
  };
  const fn = (/** @type {string} */ name) => (/** @type {Obj} */ e) => e.type === "function" && e.name === name;
  const firstErc20 = assets[1]?.ticker ?? fail("the first ERC-20 is missing");
  const getters = Object.fromEntries(
    assets.filter((a) => a.underlying.kind === "erc20").map((a) => [a.ticker, entry(a.ticker, fn(a.ticker))]),
  );

  return {
    env,
    manifestSha256: msha,
    chainId,
    owner,
    startBlock,
    libraries,
    assets,
    wrapperAbi: common,
    erc20WrapAbi: [entry(firstErc20, fn("wrap"))],
    ethWrapAbi: [entry("ETH", fn("wrap")), entry("ETH", fn("getRecoverableETH")), entry("ETH", fn("getRecoveryInfo"))],
    decimalsAbi: [entry("ETH", fn("decimals"))],
    getters,
  };
}

/** @param {unknown} v @param {string} pad @returns {string} */
function lit(v, pad = "") {
  return JSON.stringify(v, null, 2).replaceAll("\n", `\n${pad}`);
}

/**
 * TypeScript text of the environment (deterministic).
 * @param {ReturnType<typeof load>} d
 */
export function render(d) {
  const assets = d.assets.map((a) => ({
    ticker: a.ticker,
    contract: a.contract,
    address: a.address,
    iToken: a.iToken,
    underlying: a.underlying,
  }));
  return [
    `// GENERATED by scripts/generate-contracts.mjs from contracts/${d.env}/manifest.${d.env}.json. Do not edit by hand.`,
    `// SHA-256 of the manifest: ${d.manifestSha256}`,
    `import type { Deployment } from "../types";`,
    ``,
    `/** Entries common to the ${String(N_ASSETS)} wrappers (identical in all of them; verified when generating). */`,
    `export const wrapperAbi = ${lit(d.wrapperAbi)} as const;`,
    ``,
    `/** wrap(uint256) of the ERC-20 wrappers. */`,
    `export const erc20WrapAbi = ${lit(d.erc20WrapAbi)} as const;`,
    ``,
    `/** Entries specific to the ETH wrapper. */`,
    `export const ethWrapAbi = ${lit(d.ethWrapAbi)} as const;`,
    ``,
    `/** decimals() (pure in WBTC; it is read the same way). */`,
    `export const decimalsAbi = ${lit(d.decimalsAbi)} as const;`,
    ``,
    `/** Getter of the underlying of each ERC-20 wrapper (function named after the ticker). */`,
    `export const underlyingGetterAbi = ${lit(d.getters)} as const;`,
    ``,
    `export const deployment = {`,
    `  env: ${JSON.stringify(d.env)},`,
    `  manifestSha256: ${JSON.stringify(d.manifestSha256)},`,
    `  chainId: ${String(d.chainId)},`,
    `  owner: ${JSON.stringify(d.owner)},`,
    `  startBlock: ${String(d.startBlock)}n,`,
    `  libraries: ${lit(d.libraries, "  ")},`,
    `  assets: ${lit(assets, "  ")},`,
    `} as const satisfies Deployment;`,
    ``,
  ].join("\n");
}

export const MC3_SCHEMA = "inheritfi-multicall3/1";
export const MC3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
export const MC3_FILES = /** @type {const} */ ({ abi: "Multicall3.abi.json", runtime: "Multicall3.runtime.hex" });

/**
 * 4-byte selectors that the code pushes with PUSH4 (walks the opcodes skipping the data of each PUSH).
 * @param {`0x${string}`} code
 * @returns {Set<string>}
 */
export function push4Selectors(code) {
  const b = Buffer.from(code.slice(2), "hex");
  /** @type {Set<string>} */
  const out = new Set();
  for (let i = 0; i < b.length; ) {
    const op = /** @type {number} */ (b[i]);
    if (op >= 0x60 && op <= 0x7f) {
      const n = op - 0x5f;
      if (n === 4 && i + 4 < b.length) out.add(`0x${b.subarray(i + 1, i + 5).toString("hex")}`);
      i += 1 + n;
    } else {
      i += 1;
    }
  }
  return out;
}

/**
 * Reads and verifies contracts/multicall3/. Writes nothing.
 * @param {string} root
 */
export function loadMulticall3(root) {
  const dir = join(root, "contracts", "multicall3");
  if (!existsSync(dir)) fail("contracts/multicall3 is missing");
  const pins = obj(JSON.parse(readFileSync(join(root, "contracts", "pins.json"), "utf8")), "pins.json");
  const pin = sha256Hex(pins.multicall3, "pins.json[multicall3]");
  const mbuf = readFileSync(join(dir, "multicall3.json"));
  const msha = sha256(mbuf);
  if (msha !== pin) fail(`multicall3: the SHA-256 of multicall3.json (${msha}) is not the one pinned in pins.json (${pin})`);
  const m = obj(JSON.parse(mbuf.toString("utf8")), "multicall3.json");
  if (m.schema !== MC3_SCHEMA) fail(`multicall3: schema ${String(m.schema)}, expected ${MC3_SCHEMA}`);
  const address = checksummed(m.address, "multicall3.address");
  if (address !== MC3_ADDRESS) fail(`multicall3: address ${address}, expected ${MC3_ADDRESS}`);
  const codehash = str(m.codehash, "multicall3.codehash");
  if (!/^0x[0-9a-f]{64}$/.test(codehash)) fail("multicall3: malformed codehash");

  const files = obj(m.files, "multicall3.files");
  if (canonical(Object.keys(files).sort()) !== canonical(Object.keys(MC3_FILES).sort())) fail("multicall3: unexpected file list");
  /** @param {keyof typeof MC3_FILES} key */
  const readChecked = (key) => {
    const f = obj(files[key], `multicall3.files.${key}`);
    if (f.file !== MC3_FILES[key]) fail(`multicall3: file ${String(f.file)}, expected ${MC3_FILES[key]}`);
    const p = join(dir, MC3_FILES[key]);
    if (!existsSync(p) || !lstatSync(p).isFile()) fail(`multicall3: ${MC3_FILES[key]} is missing or is not a regular file`);
    const buf = readFileSync(p);
    if (sha256(buf) !== sha256Hex(f.sha256, `multicall3.files.${key}.sha256`)) fail(`multicall3: the SHA-256 of ${MC3_FILES[key]} does not match`);
    return buf;
  };
  const abiRaw = arr(JSON.parse(readChecked("abi").toString("utf8")), "multicall3: ABI");
  const runtimeText = readChecked("runtime").toString("utf8");
  if (!/^0x[0-9a-f]+\n$/.test(runtimeText) || runtimeText.length % 2 !== 1) fail("multicall3: the code is not valid hexadecimal");
  const runtime = /** @type {`0x${string}`} */ (runtimeText.trimEnd());
  if (keccak256(runtime) !== codehash) fail(`multicall3: the keccak of the code (${keccak256(runtime)}) is not the pinned codehash`);
  const allowed = new Set(["multicall3.json", ...Object.values(MC3_FILES)]);
  const extra = readdirSync(dir).filter((f) => !allowed.has(f));
  if (extra.length > 0) fail(`multicall3: unexpected files: ${extra.join(", ")}`);

  // Each function of the ABI compiled from the source has its selector in the code deployed on mainnet.
  const selectors = push4Selectors(runtime);
  const fns = abiRaw.map((e) => obj(e, "multicall3: entry")).filter((e) => e.type === "function");
  if (fns.length === 0) fail("multicall3: the ABI has no functions");
  for (const f of fns) {
    const sel = toFunctionSelector(/** @type {import("viem").AbiFunction} */ (/** @type {unknown} */ (f)));
    if (!selectors.has(sel)) fail(`multicall3: the selector of ${String(f.name)} (${sel}) is not in the code`);
  }
  /** @param {string} name @param {string} mutability */
  const pick = (name, mutability) => {
    const found = fns.filter((e) => e.name === name);
    if (found.length !== 1) fail(`multicall3: ${name} does not appear exactly once`);
    const e = /** @type {Obj} */ (found[0]);
    if (e.stateMutability !== mutability) fail(`multicall3: ${name} is ${String(e.stateMutability)}, expected ${mutability}`);
    return e;
  };
  // aggregate3 is payable in the contract; here it is declared view on purpose so that it can only be used in eth_call.
  const aggregate3 = /** @type {Obj} */ ({ ...pick("aggregate3", "payable"), stateMutability: "view" });
  const timestamp = pick("getCurrentBlockTimestamp", "view");
  const ethBalance = pick("getEthBalance", "view");
  return { metaSha256: msha, address, codehash, abi: [aggregate3, timestamp, ethBalance], functionCount: fns.length };
}

export const ERC20_SCHEMA = "inheritfi-erc20/1";
/** The 6 IERC20 functions of OpenZeppelin 5.7.0 with their signature and mutability. */
export const ERC20_FUNCTIONS = /** @type {const} */ ({
  allowance: { sig: "allowance(address,address)", selector: "0xdd62ed3e", mutability: "view", outputs: ["uint256"] },
  approve: { sig: "approve(address,uint256)", selector: "0x095ea7b3", mutability: "nonpayable", outputs: ["bool"] },
  balanceOf: { sig: "balanceOf(address)", selector: "0x70a08231", mutability: "view", outputs: ["uint256"] },
  totalSupply: { sig: "totalSupply()", selector: "0x18160ddd", mutability: "view", outputs: ["uint256"] },
  transfer: { sig: "transfer(address,uint256)", selector: "0xa9059cbb", mutability: "nonpayable", outputs: ["bool"] },
  transferFrom: { sig: "transferFrom(address,address,uint256)", selector: "0x23b872dd", mutability: "nonpayable", outputs: ["bool"] },
});

/**
 * Reads and verifies contracts/erc20/. Writes nothing.
 * @param {string} root
 */
export function loadErc20(root) {
  const dir = join(root, "contracts", "erc20");
  if (!existsSync(dir)) fail("contracts/erc20 is missing");
  const pins = obj(JSON.parse(readFileSync(join(root, "contracts", "pins.json"), "utf8")), "pins.json");
  const pin = sha256Hex(pins.erc20, "pins.json[erc20]");
  const mbuf = readFileSync(join(dir, "erc20.json"));
  const msha = sha256(mbuf);
  if (msha !== pin) fail(`erc20: the SHA-256 of erc20.json (${msha}) is not the one pinned in pins.json (${pin})`);
  const m = obj(JSON.parse(mbuf.toString("utf8")), "erc20.json");
  if (m.schema !== ERC20_SCHEMA) fail(`erc20: schema ${String(m.schema)}, expected ${ERC20_SCHEMA}`);
  const files = obj(m.files, "erc20.files");
  if (canonical(Object.keys(files)) !== canonical(["abi"])) fail("erc20: unexpected file list");
  const f = obj(files.abi, "erc20.files.abi");
  if (f.file !== "IERC20.abi.json") fail(`erc20: file ${String(f.file)}, expected IERC20.abi.json`);
  const p = join(dir, "IERC20.abi.json");
  if (!existsSync(p) || !lstatSync(p).isFile()) fail("erc20: IERC20.abi.json is missing or is not a regular file");
  const buf = readFileSync(p);
  if (sha256(buf) !== sha256Hex(f.sha256, "erc20.files.abi.sha256")) fail("erc20: the SHA-256 of IERC20.abi.json does not match");
  const extra = readdirSync(dir).filter((x) => x !== "erc20.json" && x !== "IERC20.abi.json");
  if (extra.length > 0) fail(`erc20: unexpected files: ${extra.join(", ")}`);

  const entries = arr(JSON.parse(buf.toString("utf8")), "erc20: ABI").map((e) => obj(e, "erc20: entry"));
  const fns = entries.filter((e) => e.type === "function");
  const names = fns.map((e) => str(e.name, "erc20: name")).sort();
  if (canonical(names) !== canonical(Object.keys(ERC20_FUNCTIONS).sort())) fail(`erc20: unexpected functions (${names.join(", ")})`);
  for (const e of fns) {
    const spec = ERC20_FUNCTIONS[/** @type {keyof typeof ERC20_FUNCTIONS} */ (e.name)];
    const abiFn = /** @type {import("viem").AbiFunction} */ (/** @type {unknown} */ (e));
    const sig = `${String(e.name)}(${arr(e.inputs, "erc20: inputs").map((i) => str(obj(i, "erc20: input").type, "erc20: type")).join(",")})`;
    const outs = arr(e.outputs, "erc20: outputs").map((o) => str(obj(o, "erc20: output").type, "erc20: type"));
    if (sig !== spec.sig || toFunctionSelector(abiFn) !== spec.selector) fail(`erc20: unexpected signature or selector in ${sig}`);
    if (e.stateMutability !== spec.mutability) fail(`erc20: ${sig} is ${String(e.stateMutability)}, expected ${spec.mutability}`);
    if (canonical(outs) !== canonical(spec.outputs)) fail(`erc20: unexpected outputs in ${sig}`);
  }
  /** @param {string} name */
  const pick = (name) => /** @type {Obj} */ (fns.find((e) => e.name === name));
  // approve without outputs, ON PURPOSE: some tokens return nothing; the interface does not decode the result.
  const approve = /** @type {Obj} */ ({ ...pick("approve"), outputs: [] });
  return { metaSha256: msha, readAbi: [pick("balanceOf"), pick("allowance")], approveAbi: [approve] };
}

/** @param {ReturnType<typeof loadErc20>} d */
export function renderErc20(d) {
  return [
    `// GENERATED by scripts/generate-contracts.mjs from contracts/erc20/erc20.json. Do not edit by hand.`,
    `// SHA-256 of erc20.json: ${d.metaSha256}`,
    ``,
    `/** balanceOf and allowance of IERC20 (OpenZeppelin 5.7.0), to read the 28 underlyings. */`,
    `export const erc20ReadAbi = ${lit(d.readAbi)} as const;`,
    ``,
    `/**`,
    ` * approve of IERC20 WITHOUT outputs, ON PURPOSE: the interface does not decode what it returns (some tokens return`,
    ` * nothing); it checks the result by reading the approval afterwards. Same selector (0x095ea7b3).`,
    ` */`,
    `export const erc20ApproveAbi = ${lit(d.approveAbi)} as const;`,
    ``,
  ].join("\n");
}

/** @param {ReturnType<typeof loadMulticall3>} d */
export function renderMulticall3(d) {
  return [
    `// GENERATED by scripts/generate-contracts.mjs from contracts/multicall3/multicall3.json. Do not edit by hand.`,
    `// SHA-256 of multicall3.json: ${d.metaSha256}`,
    ``,
    `/** Multicall3 v3.1.0 on Ethereum mainnet (address and code verified when generating). */`,
    `export const multicall3 = {`,
    `  address: ${JSON.stringify(d.address)},`,
    `  codehash: ${JSON.stringify(d.codehash)},`,
    `} as const;`,
    ``,
    `/**`,
    ` * Only the functions the interface uses. aggregate3 is declared view ON PURPOSE (in the contract it is payable):`,
    ` * that way TypeScript prevents using it in transactions; the interface only calls it with eth_call.`,
    ` */`,
    `export const multicall3Abi = ${lit(d.abi)} as const;`,
    ``,
  ].join("\n");
}

/** @param {string} root */
export function presentEnvs(root) {
  return ENVS.filter((e) => existsSync(join(root, "contracts", e)));
}

/** @param {string} root @param {Env} env */
export function outputPath(root, env) {
  return join(root, "src", "contracts", "generated", `${env}.ts`);
}

/** @param {string} root @param {boolean} check */
export function run(root, check) {
  const envs = presentEnvs(root);
  if (envs.length === 0) fail("there is no environment in contracts/");
  /** @type {{ env: string; path: string; text: string }[]} */
  const outputs = envs.map((env) => ({ env, path: outputPath(root, env), text: render(load(root, env)) }));
  outputs.push({ env: "multicall3", path: join(root, "src", "contracts", "generated", "multicall3.ts"), text: renderMulticall3(loadMulticall3(root)) });
  outputs.push({ env: "erc20", path: join(root, "src", "contracts", "generated", "erc20.ts"), text: renderErc20(loadErc20(root)) });
  const stale = outputs.filter((o) => !existsSync(o.path) || readFileSync(o.path, "utf8") !== o.text);
  if (check) return stale.map((o) => o.env);
  for (const o of stale) writeFileSync(o.path, o.text, { encoding: "utf8", mode: 0o644 });
  return stale.map((o) => o.env);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const check = process.argv.includes("--check");
  try {
    const changed = run(root, check);
    if (check && changed.length > 0) {
      console.error(`OUT OF DATE: ${changed.join(", ")} (run node scripts/generate-contracts.mjs)`);
      process.exit(1);
    }
    console.log(check ? "UP TO DATE" : `GENERATED: ${changed.length > 0 ? changed.join(", ") : "no changes"}`);
  } catch (e) {
    console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    console.error("Nothing was written.");
    process.exit(1);
  }
}
