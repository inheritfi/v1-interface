import type { Hash } from "viem";

/**
 * INHERITFI: waits for the result of a transaction that the wallet already sent, asking our node only for the receipt
 * of that hash (eth_getTransactionReceipt), every few seconds, until it exists or the time limit passes.
 *
 * viem's waitForTransactionReceipt is not used: while the transaction is pending it looks for a replacement by
 * requesting the block with its full transactions, a request that our RPC intermediary rejects on purpose; viem took
 * that rejection as fatal and the interface reported "couldn't be confirmed" for transactions that were confirmed
 * seconds later (found in production on 2026-11-16 with wallets that return the hash while the transaction is pending).
 *
 * Any error while asking (receipt not found yet, a network failure, a rejected request) only means "not known yet":
 * the wait goes on. "timeout" is returned only when there was no receipt in all that time; that includes a transaction
 * that the user sped up or cancelled in the wallet (its hash changes and this hash never gets a receipt).
 */
export interface ReceiptSource {
  getTransactionReceipt: (args: { hash: Hash }) => Promise<{ status: "success" | "reverted" }>;
}

export interface ReceiptWait {
  /** Pause between two questions. */
  readonly intervalMs: number;
  /** Total time before giving up. */
  readonly timeoutMs: number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
}

export const RECEIPT_WAIT: ReceiptWait = {
  intervalMs: 4_000,
  timeoutMs: 180_000,
  sleep: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  now: () => Date.now(),
};

export type ReceiptResult = "success" | "reverted" | "timeout";

export async function waitForReceipt(source: ReceiptSource, hash: Hash, wait: ReceiptWait = RECEIPT_WAIT): Promise<ReceiptResult> {
  if (wait.intervalMs <= 0 || wait.timeoutMs <= 0) throw new Error("Invalid wait");
  const start = wait.now();
  for (;;) {
    try {
      const receipt = await source.getTransactionReceipt({ hash });
      return receipt.status === "success" ? "success" : "reverted";
    } catch {
      // Not known yet (or the question failed): ask again until the time limit.
    }
    if (wait.now() - start >= wait.timeoutMs) return "timeout";
    await wait.sleep(wait.intervalMs);
  }
}
