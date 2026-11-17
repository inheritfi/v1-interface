import {
  CallExecutionError,
  ChainMismatchError,
  ExecutionRevertedError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  InsufficientFundsError,
  UserRejectedRequestError,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";
import { wrapperAbi } from "@deployment";
import { describeTxError, genericTxError } from "./txMessages";
import { chain } from "./network";

const ERROR_STRING = [{ type: "error", name: "Error", inputs: [{ name: "message", type: "string" }] }] as const;

/** The error that viem throws when simulating a call that the contract rejects, as in reality (nested). */
function reverted(data: Hex): ContractFunctionExecutionError {
  const cause = new ContractFunctionRevertedError({ abi: wrapperAbi, data, functionName: "checkActivity" });
  return new ContractFunctionExecutionError(cause, { abi: wrapperAbi, functionName: "checkActivity" });
}

describe("describeTxError", () => {
  it("rejection in the wallet", () => {
    expect(describeTxError(new UserRejectedRequestError(new Error("denied")))).toMatch(/rejected the request/);
    expect(describeTxError({ code: 4001 })).toMatch(/rejected the request/);
  });

  it("wrong network and insufficient funds", () => {
    expect(describeTxError(new ChainMismatchError({ chain, currentChainId: 1 }))).toMatch(/different network/);
    expect(describeTxError(new InsufficientFundsError())).toMatch(/Not enough ETH/);
  });

  it("require messages of the contract, known and unknown", () => {
    const data = (reason: string) => encodeErrorResult({ abi: ERROR_STRING, errorName: "Error", args: [reason] });
    expect(describeTxError(reverted(data("Not testator")))).toMatch(/no activity or balance/);
    expect(describeTxError(reverted(data("Process active")))).toMatch(/in progress/);
    expect(describeTxError(reverted(data("Total != 100%")))).toMatch(/exactly 100%/);
    expect(describeTxError(reverted(data("something new")))).toBe("The contract would reject this transaction, so it wasn't sent.");
    expect(describeTxError(reverted(data("Too soon")), "heir")).toMatch(/too soon/);
    expect(describeTxError(reverted(data("Claims closed")), "heir")).toMatch(/claims for this inheritance are closed/);
    // Same reason, explained according to who signs.
    expect(describeTxError(reverted(data("Process active")), "heir")).toMatch(/already in progress in this asset/);
    expect(describeTxError(reverted(data("Process active")), "heir")).not.toMatch(/Confirm you're active/);
    expect(describeTxError(reverted(data("Not started")), "contact")).toMatch(/recovery hasn't started/);
    expect(describeTxError(reverted(data("Not started")), "heir")).toMatch(/inheritance hasn't started/);
    expect(describeTxError(reverted(data("Already started")), "contact")).toMatch(/recovery is already in progress/);
    expect(describeTxError(reverted(data("Not recovery user")), "contact")).toMatch(/isn't a recovery contact/);
    expect(describeTxError(reverted(data("No balance")), "contact")).toMatch(/no balance left/);
    expect(describeTxError(reverted(data("Too soon")), "contact")).toMatch(/too soon/);
    expect(describeTxError(reverted(data("Process active")))).toMatch(/Confirm you're active/);
  });

  it("custom OpenZeppelin errors of the ABI", () => {
    const data = encodeErrorResult({ abi: wrapperAbi, errorName: "ERC20InsufficientBalance", args: ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 1n, 2n] });
    expect(describeTxError(reverted(data))).toMatch(/larger than your balance/);
  });

  it("low-level eth_call that reverts (approve of the underlying)", () => {
    const e = new CallExecutionError(new ExecutionRevertedError({ message: "execution reverted" }), {});
    expect(describeTxError(e)).toBe("The token would reject this transaction, so it wasn't sent.");
  });

  it("anything else: generic message, without failing", () => {
    expect(describeTxError(new Error("boom"))).toBe(genericTxError());
    expect(describeTxError("text")).toBe(genericTxError());
    expect(describeTxError(null)).toBe(genericTxError());
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(describeTxError(loop)).toBe(genericTxError());
  });
});
