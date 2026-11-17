/**
 * INHERITFI: explains in clear words why a transaction was not made.
 * It walks the chain of causes of the error (viem and wagmi) without assuming its shape: anything unknown ends in a
 * generic message, never in a failure of the interface.
 */

import { t, type MessageKey } from "../i18n";

/** `require` messages of the contracts (InheritfiV1Base.sol, InheritfiV1InheritanceLib.sol, InheritfiV1ETH.sol). */
const REVERT_REASONS: Record<string, MessageKey> = {
  "Not testator": "revert.notTestator",
  "No ETH": "revert.noEth",
  "Zero amount": "revert.zeroAmount",
  "Insufficient balance": "revert.insufficientBalance",
  "ETH transfer failed": "revert.ethTransferFailed",
  "Process active": "revert.processActive",
  "Bad input": "revert.badInput",
  "Too many heirs": "revert.tooManyHeirs",
  "Bad heir": "revert.badHeir",
  "Bad pct": "revert.badPct",
  "Dup heir": "revert.dupHeir",
  Overflow: "revert.overflow",
  "Total != 100%": "revert.total100",
  "Bad count": "revert.badCount",
  "Bad addr": "revert.badAddr",
  Dup: "revert.dup",
  // Inheritance (InheritfiV1Base.sol onlyHeir; InheritfiV1InheritanceLib.sol l. 108-250).
  "Not heir": "revert.notHeir",
  "Too soon": "revert.tooSoon",
  "No balance": "revert.noBalance",
  "Not started": "revert.notStarted",
  "Already claimed": "revert.alreadyClaimed",
  "Claims closed": "revert.claimsClosed",
  "Not claimed yet": "revert.notClaimedYet",
};

/** For the heirs, the same reason is explained from their side (the owner is the one who confirms activity). */
const HEIR_REASONS: Record<string, MessageKey> = {
  "Process active": "revertHeir.processActive",
};

/**
 * For the recovery contacts (InheritfiV1Base.sol onlyRecoveryUser; InheritfiV1InheritanceLib.sol l. 337-381):
 * "Not started" refers to the recovery, not to the inheritance.
 */
const CONTACT_REASONS: Record<string, MessageKey> = {
  "Not recovery user": "revertContact.notRecoveryUser",
  "Already started": "revertContact.alreadyStarted",
  "Not started": "revertContact.notStarted",
};

/** Custom OpenZeppelin errors that can appear (ABI of the wrappers). */
const CUSTOM_ERRORS: Record<string, MessageKey> = {
  ERC20InsufficientBalance: "revertCustom.insufficientBalance",
  ERC20InsufficientAllowance: "revertCustom.insufficientAllowance",
  SafeERC20FailedOperation: "revertCustom.safeErc20Failed",
  ReentrancyGuardReentrantCall: "revertCustom.reentrantCall",
};

export const genericTxError = (): string => t("tx.generic");

/** Stop decided by the interface with a message already written for the user (it is shown as it is). */
export class TxStop extends Error {
  override name = "TxStop";
}

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  reason?: unknown;
  data?: unknown;
  cause?: unknown;
}

function chain(error: unknown): ErrorLike[] {
  const out: ErrorLike[] = [];
  let current: unknown = error;
  // Depth limit in case a cause points to itself.
  for (let i = 0; i < 20 && typeof current === "object" && current !== null; i++) {
    const e = current as ErrorLike;
    out.push(e);
    current = e.cause;
  }
  return out;
}

/** Known reason followed by "Nothing was sent." (the key exists because it comes from the maps above). */
function reasonText(key: MessageKey | undefined): string {
  return t("tx.reasonNothingSent", { reason: key === undefined ? "" : t(key) });
}

export function describeTxError(error: unknown, role: "owner" | "heir" | "contact" = "owner"): string {
  const errors = chain(error);
  if (errors.some((e) => e.name === "UserRejectedRequestError" || e.code === 4001)) {
    return t("tx.rejected");
  }
  if (errors.some((e) => e.name === "ChainMismatchError" || e.name === "ConnectorChainMismatchError")) {
    return t("tx.wrongChain");
  }
  if (errors.some((e) => e.name === "InsufficientFundsError")) {
    return t("tx.noEth");
  }
  const reverted = errors.find((e) => e.name === "ContractFunctionRevertedError");
  if (reverted !== undefined) {
    if (role === "heir" && typeof reverted.reason === "string" && reverted.reason in HEIR_REASONS) {
      return reasonText(HEIR_REASONS[reverted.reason]);
    }
    if (role === "contact" && typeof reverted.reason === "string" && reverted.reason in CONTACT_REASONS) {
      return reasonText(CONTACT_REASONS[reverted.reason]);
    }
    if (typeof reverted.reason === "string" && reverted.reason in REVERT_REASONS) {
      return reasonText(REVERT_REASONS[reverted.reason]);
    }
    const data = reverted.data;
    if (typeof data === "object" && data !== null && "errorName" in data && typeof data.errorName === "string") {
      const known = CUSTOM_ERRORS[data.errorName];
      if (known !== undefined) return reasonText(known);
    }
    return t("tx.contractWouldReject");
  }
  // A low-level eth_call (approve of the underlying token) that reverts: viem wraps it in ExecutionRevertedError.
  if (errors.some((e) => e.name === "ExecutionRevertedError")) {
    return t("tx.tokenWouldReject");
  }
  return genericTxError();
}
