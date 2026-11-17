// @ts-check
import { Buffer } from "node:buffer";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { toFunctionSelector } from "viem";
import { GenerateError, load, loadErc20, loadMulticall3, push4Selectors, run, sha256 } from "./generate-contracts.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENV = "mainnet";

/** @type {string[]} */
const temps = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

/** Copy of contracts/ in a temporary folder, to alter it without touching the repository. */
function copy() {
  const t = mkdtempSync(join(tmpdir(), "inheritfi-gen-"));
  temps.push(t);
  cpSync(join(ROOT, "contracts"), join(t, "contracts"), { recursive: true });
  return t;
}

/** @param {string} root */
const manifestPath = (root) => join(root, "contracts", ENV, `manifest.${ENV}.json`);

/**
 * Changes the text of the manifest and pins its SHA-256 again, to test the checks that come after it.
 * @param {string} root
 * @param {string} from
 * @param {string} to
 */
function editManifest(root, from, to) {
  const before = readFileSync(manifestPath(root), "utf8");
  expect(before.split(from)).toHaveLength(2);
  const text = before.replace(from, to);
  writeFileSync(manifestPath(root), text);
  writeFileSync(join(root, "contracts", "pins.json"), JSON.stringify({ [ENV]: sha256(Buffer.from(text)) }));
}

/** @param {string} root @param {RegExp} message */
function expectFail(root, message) {
  expect(() => load(root, ENV)).toThrow(GenerateError);
  expect(() => load(root, ENV)).toThrow(message);
}

/** @param {unknown} e */
const isCheckActivity = (e) => typeof e === "object" && e !== null && "name" in e && e.name === "checkActivity";

describe("generate-contracts", () => {
  it("the generated file in the repository is up to date", () => {
    expect(run(ROOT, true)).toEqual([]);
  });

  it("verifies the real manifest: 29 assets, 2 libraries and 197 common entries", () => {
    const d = load(ROOT, ENV);
    expect(d.assets).toHaveLength(29);
    expect(d.libraries).toHaveLength(2);
    expect(d.wrapperAbi).toHaveLength(197);
    expect(d.chainId).toBe(1);
  });

  it("rejects a manifest whose SHA-256 is not the pinned one", () => {
    const t = copy();
    writeFileSync(manifestPath(t), `${readFileSync(manifestPath(t), "utf8")} `);
    expectFail(t, /is not the one pinned in pins\.json/);
  });

  it("rejects an altered ABI", () => {
    const t = copy();
    const p = join(t, "contracts", ENV, "abi", "InheritfiV1DAI.json");
    writeFileSync(p, `${readFileSync(p, "utf8")} `);
    expectFail(t, /InheritfiV1DAI: the SHA-256/);
  });

  it("rejects ABI files that the manifest does not mention", () => {
    const t = copy();
    writeFileSync(join(t, "contracts", ENV, "abi", "Extra.json"), "[]");
    expectFail(t, /is not in the manifest/);
  });

  it("rejects an ABI that does not follow the pattern even if its SHA-256 matches", () => {
    const t = copy();
    const p = join(t, "contracts", ENV, "abi", "InheritfiV1LINK.json");
    const before = readFileSync(p);
    /** @type {unknown} */
    const parsed = JSON.parse(before.toString("utf8"));
    expect(Array.isArray(parsed)).toBe(true);
    const abi = /** @type {unknown[]} */ (parsed);
    const text = `${JSON.stringify(abi.filter((e) => !isCheckActivity(e)), null, 2)}\n`;
    writeFileSync(p, text);
    editManifest(t, sha256(before), sha256(Buffer.from(text)));
    expectFail(t, /InheritfiV1LINK: the ABI does not follow the pattern/);
  });

  it("rejects a chainId that does not match the environment", () => {
    const t = copy();
    editManifest(t, '"chainId": 1,', '"chainId": 31337,');
    expectFail(t, /chainId 31337 not allowed/);
  });

  it("rejects addresses without EIP-55 checksum", () => {
    const t = copy();
    const owner = "0xD01288D704B7116BAcb49585680eC422e53409Ba";
    editManifest(t, `"owner": "${owner}"`, `"owner": "${owner.toLowerCase()}"`);
    expectFail(t, /owner: the address is not in EIP-55 checksum format/);
  });
});

const MC3 = (/** @type {string} */ root) => join(root, "contracts", "multicall3");

/**
 * Rewrites a Multicall3 file, updates its SHA-256 in multicall3.json and pins multicall3.json again,
 * to test the checks that come after the SHA-256.
 * @param {string} root
 * @param {"abi" | "runtime"} key
 * @param {string} file
 * @param {string} text
 */
function rewriteMc3(root, key, file, text) {
  writeFileSync(join(MC3(root), file), text);
  const metaPath = join(MC3(root), "multicall3.json");
  /** @type {unknown} */
  const metaRaw = JSON.parse(readFileSync(metaPath, "utf8"));
  const meta = /** @type {{ files: Record<string, { file: string; sha256: string }> }} */ (metaRaw);
  const entry = meta.files[key];
  if (entry === undefined) throw new Error(key);
  entry.sha256 = sha256(Buffer.from(text));
  const metaText = `${JSON.stringify(meta, null, 2)}\n`;
  writeFileSync(metaPath, metaText);
  /** @type {unknown} */
  const pinsRaw = JSON.parse(readFileSync(join(root, "contracts", "pins.json"), "utf8"));
  const pins = /** @type {Record<string, string>} */ (pinsRaw);
  pins.multicall3 = sha256(Buffer.from(metaText));
  writeFileSync(join(root, "contracts", "pins.json"), JSON.stringify(pins));
}

/** @param {string} root @param {RegExp} message */
function expectMc3Fail(root, message) {
  expect(() => loadMulticall3(root)).toThrow(GenerateError);
  expect(() => loadMulticall3(root)).toThrow(message);
}

describe("generate-contracts: Multicall3", () => {
  it("verifies the real Multicall3: address, mainnet codehash, 16 functions, aggregate3 as view and the 3 functions the interface uses", () => {
    const d = loadMulticall3(ROOT);
    expect(d.address).toBe("0xcA11bde05977b3631167028862bE2a173976CA11");
    expect(d.codehash).toBe("0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891");
    expect(d.functionCount).toBe(16);
    expect(d.abi.map((e) => [e.name, e.stateMutability])).toEqual([
      ["aggregate3", "view"],
      ["getCurrentBlockTimestamp", "view"],
      ["getEthBalance", "view"],
    ]);
  });

  it("the selectors come from the PUSH4 of the code, not from the data", () => {
    expect(push4Selectors("0x6382ad56cb00").has("0x82ad56cb")).toBe(true);
    // 0x61 pushes 2 bytes: the 0x63 inside is data, not a PUSH4.
    expect(push4Selectors("0x61006382ad56cb").has("0x82ad56cb")).toBe(false);
  });

  it("rejects multicall3.json if it is not the pinned one", () => {
    const t = copy();
    const p = join(MC3(t), "multicall3.json");
    writeFileSync(p, `${readFileSync(p, "utf8")} `);
    expectMc3Fail(t, /multicall3.json .* is not the one pinned/);
  });

  it("rejects a file whose SHA-256 is not the one in multicall3.json", () => {
    const t = copy();
    const p = join(MC3(t), "Multicall3.abi.json");
    writeFileSync(p, `${readFileSync(p, "utf8")} `);
    expectMc3Fail(t, /SHA-256 of Multicall3.abi.json does not match/);
  });

  it("rejects code different from mainnet's even if its SHA-256 matches", () => {
    const t = copy();
    const code = readFileSync(join(MC3(t), "Multicall3.runtime.hex"), "utf8");
    rewriteMc3(t, "runtime", "Multicall3.runtime.hex", code.replace(/0033\n$/, "0034\n"));
    expectMc3Fail(t, /keccak of the code .* is not the pinned codehash/);
  });

  it("rejects an ABI with a function that is not in the code", () => {
    const t = copy();
    /** @type {unknown} */
    const abiRaw = JSON.parse(readFileSync(join(MC3(t), "Multicall3.abi.json"), "utf8"));
    const abi = /** @type {unknown[]} */ (abiRaw);
    abi.push({ type: "function", name: "drain", inputs: [], outputs: [], stateMutability: "nonpayable" });
    rewriteMc3(t, "abi", "Multicall3.abi.json", `${JSON.stringify(abi, null, 2)}\n`);
    expectMc3Fail(t, /selector of drain .* is not in the code/);
  });

  it("rejects files that multicall3.json does not mention", () => {
    const t = copy();
    writeFileSync(join(MC3(t), "extra.txt"), "x");
    expectMc3Fail(t, /unexpected files: extra.txt/);
  });
});

const ERC20 = (/** @type {string} */ root) => join(root, "contracts", "erc20");

/**
 * Rewrites the IERC20 ABI, updates its SHA-256 in erc20.json and pins erc20.json again, to test the
 * checks that come after the SHA-256.
 * @param {string} root
 * @param {(abi: Record<string, unknown>[]) => void} change
 */
function rewriteErc20Abi(root, change) {
  /** @type {unknown} */
  const abiRaw = JSON.parse(readFileSync(join(ERC20(root), "IERC20.abi.json"), "utf8"));
  const abi = /** @type {Record<string, unknown>[]} */ (abiRaw);
  change(abi);
  const text = `${JSON.stringify(abi, null, 2)}\n`;
  writeFileSync(join(ERC20(root), "IERC20.abi.json"), text);
  const metaPath = join(ERC20(root), "erc20.json");
  /** @type {unknown} */
  const metaRaw = JSON.parse(readFileSync(metaPath, "utf8"));
  const meta = /** @type {{ files: { abi: { sha256: string } } }} */ (metaRaw);
  meta.files.abi.sha256 = sha256(Buffer.from(text));
  const metaText = `${JSON.stringify(meta, null, 2)}\n`;
  writeFileSync(metaPath, metaText);
  /** @type {unknown} */
  const pinsRaw = JSON.parse(readFileSync(join(root, "contracts", "pins.json"), "utf8"));
  const pins = /** @type {Record<string, string>} */ (pinsRaw);
  pins.erc20 = sha256(Buffer.from(metaText));
  writeFileSync(join(root, "contracts", "pins.json"), JSON.stringify(pins));
}

/** @param {string} root @param {RegExp} message */
function expectErc20Fail(root, message) {
  expect(() => loadErc20(root)).toThrow(GenerateError);
  expect(() => loadErc20(root)).toThrow(message);
}

describe("generate-contracts: IERC20", () => {
  it("verifies the real ABI: balanceOf and allowance for reading, approve without outputs and with its selector", () => {
    const d = loadErc20(ROOT);
    expect(d.readAbi.map((e) => [e.name, e.stateMutability])).toEqual([
      ["balanceOf", "view"],
      ["allowance", "view"],
    ]);
    const approve = d.approveAbi[0];
    if (approve === undefined) throw new Error("approve");
    expect(approve.name).toBe("approve");
    expect(approve.outputs).toEqual([]);
    expect(toFunctionSelector(/** @type {import("viem").AbiFunction} */ (/** @type {unknown} */ (approve)))).toBe("0x095ea7b3");
  });

  it("rejects erc20.json if it is not the pinned one", () => {
    const t = copy();
    const p = join(ERC20(t), "erc20.json");
    writeFileSync(p, `${readFileSync(p, "utf8")} `);
    expectErc20Fail(t, /erc20.json .* is not the one pinned/);
  });

  it("rejects an ABI whose SHA-256 is not the one in erc20.json", () => {
    const t = copy();
    const p = join(ERC20(t), "IERC20.abi.json");
    writeFileSync(p, `${readFileSync(p, "utf8")} `);
    expectErc20Fail(t, /SHA-256 of IERC20.abi.json does not match/);
  });

  it("rejects an extra function even if its SHA-256 matches", () => {
    const t = copy();
    rewriteErc20Abi(t, (abi) => {
      abi.push({ type: "function", name: "mint", inputs: [], outputs: [], stateMutability: "nonpayable" });
    });
    expectErc20Fail(t, /unexpected functions/);
  });

  it("rejects approve with another signature or other outputs", () => {
    const t = copy();
    rewriteErc20Abi(t, (abi) => {
      const a = abi.find((e) => e.name === "approve");
      if (a === undefined) throw new Error("approve");
      a.outputs = [];
    });
    expectErc20Fail(t, /unexpected outputs in approve/);
    const u = copy();
    rewriteErc20Abi(u, (abi) => {
      const a = abi.find((e) => e.name === "approve");
      if (a === undefined) throw new Error("approve");
      a.inputs = [{ name: "spender", type: "address", internalType: "address" }];
    });
    expectErc20Fail(u, /unexpected signature or selector in approve\(address\)/);
  });

  it("rejects files that erc20.json does not mention", () => {
    const t = copy();
    writeFileSync(join(ERC20(t), "extra.txt"), "x");
    expectErc20Fail(t, /unexpected files: extra.txt/);
  });
});
