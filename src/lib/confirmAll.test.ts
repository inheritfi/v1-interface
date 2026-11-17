import { describe, expect, it } from "vitest";
import type { DeployedAsset } from "../contracts/types";
import { anyInProgress, confirmAllTargets, CONFIRM_ALL_MIN, type ConfirmRow } from "./confirmAll";

const asset = (ticker: string) => ({ ticker }) as unknown as DeployedAsset;
const row = (ticker: string, o: Partial<Omit<ConfirmRow, "asset">> = {}): ConfirmRow => ({
  asset: asset(ticker),
  balance: 0n,
  hasPlan: false,
  activityTimestamp: 0n,
  inheritanceStarted: false,
  recoveryStarted: false,
  ...o,
});
const tickers = (rows: readonly ConfirmRow[]) => rows.map((r) => r.asset.ticker);

describe("confirmAllTargets", () => {
  it("only assets with balance or with a plan where the contract accepts it (onlyTestator)", () => {
    const rows = [
      row("ETH", { balance: 5n, activityTimestamp: 100n }),
      row("AAVE"),
      // Old activity without balance or plan: it is not confirmed (option 1A).
      row("AXS", { activityTimestamp: 50n }),
      row("COMP", { hasPlan: true, activityTimestamp: 70n }),
      // Balance received by transfer, without own activity: the contract accepts it (balance > 0).
      row("CRV", { balance: 1n }),
      // Plan without activity or balance: it cannot happen in the contract, but if it did, onlyTestator would reject it.
      row("CVX", { hasPlan: true }),
    ];
    expect(tickers(confirmAllTargets(rows))).toEqual(["CRV", "COMP", "ETH"]);
  });

  it("first recovery started, then inheritance started, then from the oldest activity to the most recent", () => {
    const rows = [
      row("ETH", { balance: 1n, activityTimestamp: 300n }),
      row("AAVE", { balance: 1n, activityTimestamp: 100n, inheritanceStarted: true }),
      row("AXS", { balance: 1n, activityTimestamp: 200n }),
      row("COMP", { balance: 0n, hasPlan: true, activityTimestamp: 400n, recoveryStarted: true }),
      row("CRV", { balance: 1n, activityTimestamp: 100n }),
      row("CVX", { balance: 1n, activityTimestamp: 50n, inheritanceStarted: true }),
    ];
    expect(tickers(confirmAllTargets(rows))).toEqual(["COMP", "AAVE", "CVX", "CRV", "AXS", "ETH"]);
  });

  it("ties by the order of the manifest; the input is not modified", () => {
    const rows = [row("ETH", { balance: 1n, activityTimestamp: 100n }), row("AAVE", { balance: 1n, activityTimestamp: 100n }), row("AXS", { balance: 1n, activityTimestamp: 100n })];
    const copy = [...rows];
    expect(tickers(confirmAllTargets(rows))).toEqual(["ETH", "AAVE", "AXS"]);
    expect(rows).toEqual(copy);
  });

  it("button with 2 or more; processes note only if any is in progress", () => {
    expect(CONFIRM_ALL_MIN).toBe(2);
    expect(anyInProgress([row("ETH", { balance: 1n })])).toBe(false);
    expect(anyInProgress([row("ETH", { balance: 1n }), row("AAVE", { balance: 1n, inheritanceStarted: true })])).toBe(true);
    expect(anyInProgress([row("ETH", { balance: 1n, recoveryStarted: true })])).toBe(true);
  });
});
