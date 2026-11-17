import { createPublicClient, custom } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { RECEIPT_WAIT, waitForReceipt, type ReceiptSource, type ReceiptWait } from "./receipt";

const HASH = `0x${"ab".repeat(32)}` as const;

/** A clock that only advances when the wait sleeps, and a source that answers from a script, one entry per question. */
function setup(script: readonly ("pending" | "network" | "success" | "reverted")[]) {
  let time = 0;
  const asked: number[] = [];
  const wait: ReceiptWait = {
    intervalMs: 4_000,
    timeoutMs: 180_000,
    sleep: (ms) => {
      time += ms;
      return Promise.resolve();
    },
    now: () => time,
  };
  const source: ReceiptSource = {
    getTransactionReceipt: ({ hash }) => {
      expect(hash).toBe(HASH);
      const step = script[asked.length] ?? "pending";
      asked.push(time);
      if (step === "pending") return Promise.reject(new Error("Transaction receipt could not be found"));
      if (step === "network") return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve({ status: step });
    },
  };
  return { wait, source, asked, elapsed: () => time };
}

describe("waitForReceipt", () => {
  it("returns at once when the receipt already exists", async () => {
    const s = setup(["success"]);
    expect(await waitForReceipt(s.source, HASH, s.wait)).toBe("success");
    expect(s.asked).toEqual([0]);
  });

  it("keeps asking while the transaction is pending and returns its result (the production case of 2026-11-16)", async () => {
    const s = setup(["pending", "pending", "pending", "success"]);
    expect(await waitForReceipt(s.source, HASH, s.wait)).toBe("success");
    expect(s.asked).toEqual([0, 4_000, 8_000, 12_000]);
  });

  it("reports a reverted transaction as reverted", async () => {
    const s = setup(["pending", "reverted"]);
    expect(await waitForReceipt(s.source, HASH, s.wait)).toBe("reverted");
  });

  it("a network failure or a rejected request does not stop the wait", async () => {
    const s = setup(["network", "pending", "network", "network", "success"]);
    expect(await waitForReceipt(s.source, HASH, s.wait)).toBe("success");
    expect(s.asked).toHaveLength(5);
  });

  it("gives up only after the time limit, having asked until then", async () => {
    const s = setup([]);
    expect(await waitForReceipt(s.source, HASH, s.wait)).toBe("timeout");
    expect(s.elapsed()).toBe(180_000);
    expect(s.asked).toHaveLength(46);
    expect(s.asked.at(-1)).toBe(180_000);
  });

  it("a receipt that arrives on the last question still counts", async () => {
    const script = [...Array<"pending">(45).fill("pending"), "success" as const];
    const s = setup(script);
    expect(await waitForReceipt(s.source, HASH, s.wait)).toBe("success");
  });

  it("asks only for the receipt: every 4 seconds for 3 minutes by default", () => {
    expect([RECEIPT_WAIT.intervalMs, RECEIPT_WAIT.timeoutMs]).toEqual([4_000, 180_000]);
  });

  it("rejects an invalid wait", async () => {
    const s = setup([]);
    await expect(waitForReceipt(s.source, HASH, { ...s.wait, intervalMs: 0 })).rejects.toThrow();
    await expect(waitForReceipt(s.source, HASH, { ...s.wait, timeoutMs: 0 })).rejects.toThrow();
  });
});

describe("waitForReceipt with a real viem client", () => {
  it("sends only eth_getTransactionReceipt while the transaction is pending (nothing the RPC intermediary rejects)", async () => {
    const methods: string[] = [];
    const receipt = {
      transactionHash: HASH,
      blockHash: HASH,
      blockNumber: "0x66",
      transactionIndex: "0x0",
      from: `0x${"11".repeat(20)}`,
      to: `0x${"22".repeat(20)}`,
      contractAddress: null,
      cumulativeGasUsed: "0x1",
      gasUsed: "0x1",
      effectiveGasPrice: "0x1",
      logs: [],
      logsBloom: `0x${"00".repeat(256)}`,
      status: "0x1",
      type: "0x2",
    };
    const client = createPublicClient({
      chain: mainnet,
      transport: custom({
        request: ({ method }: { method: string }) => {
          methods.push(method);
          // Like our intermediary: anything else would be rejected. The receipt exists from the third question on.
          if (method !== "eth_getTransactionReceipt") return Promise.reject(new Error("method not allowed"));
          return Promise.resolve(methods.length >= 3 ? receipt : null);
        },
      }),
    });
    const s = setup([]);
    expect(await waitForReceipt(client, HASH, s.wait)).toBe("success");
    expect(methods).toEqual(["eth_getTransactionReceipt", "eth_getTransactionReceipt", "eth_getTransactionReceipt"]);
  });
});
