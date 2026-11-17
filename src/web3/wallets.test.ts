import { describe, expect, it } from "vitest";
import {
  SUPPORTED_WALLETS,
  cleanIcon,
  cleanName,
  displayUrl,
  fixedRows,
  imitates,
  otherRows,
  usableConnectors,
  type Announced,
} from "./wallets";

let n = 0;
const c = (id: string) => ({ id, uid: `uid-${id}-${(n++).toString()}` });
const SVG = "data:image/svg+xml;base64,PHN2Zy8+";
const a = (rdns: string, name = rdns, icon = SVG): Announced => ({ uuid: `uuid-${(n++).toString()}`, rdns, name, icon });

describe("fixed wallets", () => {
  it("are MetaMask (extension and in-app browser), Coinbase Wallet, Rabby and Phantom, with their official download pages", () => {
    expect(SUPPORTED_WALLETS.map((w) => [w.name, w.rdns, w.installUrl])).toEqual([
      ["MetaMask", ["io.metamask", "io.metamask.mobile"], "https://metamask.com/download"],
      ["Coinbase Wallet", ["com.coinbase.wallet"], "https://www.coinbase.com/wallet/downloads"],
      ["Rabby Wallet", ["io.rabby"], "https://rabby.io/"],
      ["Phantom", ["app.phantom"], "https://phantom.com/download"],
    ]);
  });

  it("always has the four rows, installed or not", () => {
    const rows = fixedRows([], []);
    expect(rows.map((r) => [r.wallet.name, r.connector, r.duplicated])).toEqual([
      ["MetaMask", undefined, false],
      ["Coinbase Wallet", undefined, false],
      ["Rabby Wallet", undefined, false],
      ["Phantom", undefined, false],
    ]);
  });

  it("finds MetaMask by either identifier", () => {
    expect(fixedRows([c("io.metamask.mobile")], [a("io.metamask.mobile")])[0]?.connector?.id).toBe("io.metamask.mobile");
  });

  it("blocks a wallet whose identifier two extensions declare, even if wagmi kept one connector", () => {
    const announced = [a("io.rabby"), a("io.rabby"), a("io.metamask")];
    const rows = fixedRows([c("io.rabby"), c("io.metamask")], announced);
    expect(rows.map((r) => r.duplicated)).toEqual([false, false, true, false]);
    expect(usableConnectors([c("io.rabby"), c("io.metamask")], announced).map((k) => k.id)).toEqual(["io.metamask"]);
  });
});

describe("other wallets", () => {
  it("lists only the extensions that are not one of the fixed wallets", () => {
    const announced = [a("io.metamask", "MetaMask"), a("com.example", "Example Wallet"), a("io.metamask.mobile", "MetaMask"), a("app.phantom", "Phantom")];
    expect(otherRows([], announced).map((r) => r.name)).toEqual(["Example Wallet"]);
  });

  it("is empty when there is no other extension", () => {
    expect(otherRows([c("io.rabby")], [a("io.rabby")])).toEqual([]);
  });

  it("blocks an extension that uses the name of one of ours, also with look-alike letters or extra words", () => {
    for (const name of ["MetaMask", "metamask wallet", "Meta Mask", "MetaМask", "C0inbase Wallet", "Rabby", "Phant0m", "Mеtamask Pro"]) {
      expect(imitates(name), name).toBe(true);
    }
    for (const name of ["Example Wallet", "Trust", "WalletConnect", "1inch Wallet", "Zerion"]) {
      expect(imitates(name), name).toBe(false);
    }
    const rows = otherRows([c("com.fake")], [a("com.fake", "MetaMask")]);
    expect(rows[0]?.state).toBe("imitation");
    expect(usableConnectors([c("com.fake")], [a("com.fake", "MetaMask")])).toEqual([]);
  });

  it("blocks an identifier that two other extensions declare", () => {
    const announced = [a("com.example", "Example"), a("com.example", "Example")];
    expect(otherRows([c("com.example")], announced).map((r) => r.state)).toEqual(["duplicate", "duplicate"]);
    expect(usableConnectors([c("com.example")], announced)).toEqual([]);
  });

  it("lets a clean other wallet be connected", () => {
    expect(usableConnectors([c("com.example")], [a("com.example", "Example")]).map((k) => k.id)).toEqual(["com.example"]);
  });

  it("returns nothing usable when nothing is installed (reconnect must then be skipped)", () => {
    expect(usableConnectors([], [])).toEqual([]);
  });
});

describe("untrusted data from extensions", () => {
  it("cleans names: no control, bidirectional or zero-width characters, at most 32 characters", () => {
    expect(cleanName("  Good‮  Wal​let\n ")).toBe("Good Wallet");
    expect(Array.from(cleanName("x".repeat(80)))).toHaveLength(32);
    expect(cleanName("x".repeat(80)).endsWith("…")).toBe(true);
    expect(otherRows([], [a("com.example", "​")])[0]?.name).toBe("com.example");
  });

  it("accepts only data: images of known types and limited size", () => {
    expect(cleanIcon(SVG)).toBe(SVG);
    expect(cleanIcon("data:image/png;base64,iVBORw0KGgo=")).not.toBeNull();
    expect(cleanIcon("data:image/svg+xml,%3Csvg%2F%3E")).not.toBeNull();
    expect(cleanIcon("https://evil.example/icon.png")).toBeNull();
    expect(cleanIcon("javascript:alert(1)")).toBeNull();
    expect(cleanIcon("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(cleanIcon(`data:image/png;base64,${"A".repeat(100_001)}`)).toBeNull();
  });
});

describe("install links", () => {
  it("show where they go", () => {
    expect(SUPPORTED_WALLETS.map((w) => displayUrl(w.installUrl))).toEqual([
      "metamask.com/download",
      "coinbase.com/wallet/downloads",
      "rabby.io",
      "phantom.com/download",
    ]);
  });
});
