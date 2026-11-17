import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { encodeFunctionData, isAddressEqual, type Address, type Hash, type PublicClient } from "viem";
import { useConfig, useConnection, usePublicClient } from "wagmi";
import { writeContract } from "wagmi/actions";
import { wrapperAbi } from "@deployment";
import { erc20ApproveAbi, erc20ReadAbi } from "../contracts/generated/erc20";
import type { DeployedAsset, Hex40 } from "../contracts/types";
import { approveReturnOk, expectedAllowanceAfter, planWrapSteps, type WrapStep } from "../lib/approval";
import { formatExact } from "../lib/format";
import { withGasMargin } from "../lib/gas";
import { readEthMax, type EthMax } from "./ethMax";
import { erc20WrapperAbi, ethWrapperAbi } from "./abis";
import { chain } from "./network";
import { waitForReceipt } from "./receipt";
import { describeTxError, TxStop } from "./txMessages";
import { t } from "../i18n";

/**
 * INHERITFI: one transaction at a time, always with the same steps:
 *   1. check the account and network of the wallet;
 *   2. simulate it against OUR node (eth_call): if the contract would reject it, it is explained and no signature is requested; and
 *      estimate its gas on our node, with margin (src/lib/gas.ts);
 *   3. ask the wallet for the signature with that gas limit (wagmi/viem check the network again right before);
 *   4. wait for the receipt on our node and check that the transaction was executed;
 *   5. if it was an approval, read the real approval and require it to be exactly the one requested; if it was a list of
 *      heirs or contacts, read it and require it to be exactly the one signed;
 *   6. read the plan again.
 * Wrapping an ERC-20 chains several of these transactions (src/lib/approval.ts), each one with all the steps.
 */
export type TxIntent =
  | { kind: "checkActivity"; asset: DeployedAsset }
  | { kind: "wrapEth"; asset: DeployedAsset; value: bigint }
  | { kind: "unwrap"; asset: DeployedAsset; amount: bigint }
  /** approve(wrapper, amount) on the underlying token of an ERC-20 asset (0 = cancel the approval). */
  | { kind: "approve"; asset: DeployedAsset; amount: bigint }
  /** wrap(amount) of the ERC-20 wrapper (it needs the approval already on the chain). */
  | { kind: "wrapToken"; asset: DeployedAsset; amount: bigint }
  /** setHeirs: replaces the full list of heirs of the asset (percentages in basis points). */
  | { kind: "setHeirs"; asset: DeployedAsset; wallets: readonly Address[]; bps: readonly bigint[] }
  /** setRecoveryUsers: replaces the full list of recovery contacts of the asset. */
  | { kind: "setRecoveryUsers"; asset: DeployedAsset; wallets: readonly Address[] }
  /** Actions of the heir on the inheritance of `owner` in the asset (onlyHeir). */
  | { kind: "startInheritance" | "executeInheritance" | "executeInheritanceRemaining"; asset: DeployedAsset; owner: Address }
  /** Actions of the recovery contact on the asset of `owner` (onlyRecoveryUser). */
  | { kind: "startRecovery" | "executeRecovery"; asset: DeployedAsset; owner: Address };

const HEIR_INTENTS = new Set<TxIntent["kind"]>(["startInheritance", "executeInheritance", "executeInheritanceRemaining"]);
const CONTACT_INTENTS = new Set<TxIntent["kind"]>(["startRecovery", "executeRecovery"]);
const roleOf = (kind: TxIntent["kind"]): "owner" | "heir" | "contact" => (HEIR_INTENTS.has(kind) ? "heir" : CONTACT_INTENTS.has(kind) ? "contact" : "owner");

/**
 * Actions that can be chained (one transaction per asset): of the heir, "Start all" / "Claim all" / "Claim the rest in all"; of the contact,
 * "Start all" / "Recover all".
 */
export interface HeirSequenceIntent {
  kind: "startInheritance" | "executeInheritance" | "executeInheritanceRemaining" | "startRecovery" | "executeRecovery";
  asset: DeployedAsset;
  owner: Address;
}

/** Of the owner, "Confirm I'm active in all": checkActivity in each asset (src/lib/confirmAll.ts). */
export type SequenceIntent = HeirSequenceIntent | { kind: "checkActivity"; asset: DeployedAsset };

export type TxPhase =
  | { kind: "idle" }
  | { kind: "checking"; label: string }
  | { kind: "wallet"; label: string }
  | { kind: "pending"; label: string; hash: Hash }
  | { kind: "done"; label: string; hash: Hash }
  | { kind: "failed"; label: string; message: string; hash?: Hash };

export interface TxController {
  phase: TxPhase;
  busy: boolean;
  /** The wallet is on the network of the manifest. */
  chainOk: boolean;
  run: (label: string, intent: TxIntent) => Promise<void>;
  /** Wrapping an ERC-20 with exact approval: approve(0) if needed, approve(amount) if needed and wrap. */
  wrapToken: (label: string, asset: DeployedAsset, amount: bigint) => Promise<void>;
  /**
   * Several transactions, one after another (one signature per asset): of the heir, of the contact or "Confirm I'm active in all". Each one with all the steps (simulation,
   * signature, receipt, new read). If one fails or is rejected, the following ones are not sent and it says how many were made.
   */
  runSequence: (label: string, intents: readonly SequenceIntent[]) => Promise<void>;
  /** "Max" when wrapping ETH: the balance minus the reserve for the network fee (ethMaxAfterReserve). */
  ethMax: (asset: DeployedAsset, balance: bigint) => Promise<EthMax>;
  dismiss: () => void;
}

export type { EthMax } from "./ethMax";

export const isBusy = (p: TxPhase): boolean => p.kind === "checking" || p.kind === "wallet" || p.kind === "pending";

function tokenOf(asset: DeployedAsset): { address: Hex40; symbol: string; decimals: number } {
  if (asset.underlying.kind !== "erc20") throw new Error("Not an ERC-20 asset");
  return asset.underlying;
}

/** Current approval of the owner to the wrapper of the asset, read on our node. */
export function readAllowance(client: PublicClient, account: Address, asset: DeployedAsset): Promise<bigint> {
  return client.readContract({ address: tokenOf(asset).address, abi: erc20ReadAbi, functionName: "allowance", args: [account, asset.address] });
}

/** Simulates the transaction (throws if the contract would reject it) and returns the gas limit with margin. */
async function simulate(client: PublicClient, account: Address, intent: TxIntent): Promise<bigint> {
  const base = { account, address: intent.asset.address } as const;
  switch (intent.kind) {
    case "checkActivity": {
      const q = { ...base, abi: wrapperAbi, functionName: "checkActivity" } as const;
      await client.simulateContract(q);
      return withGasMargin(await client.estimateContractGas(q));
    }
    case "wrapEth": {
      if (intent.asset.underlying.kind !== "native") throw new Error("Not the ETH wrapper");
      const q = { ...base, abi: ethWrapperAbi, functionName: "wrap", value: intent.value } as const;
      await client.simulateContract(q);
      return withGasMargin(await client.estimateContractGas(q));
    }
    case "unwrap": {
      const q = { ...base, abi: wrapperAbi, functionName: "unwrap", args: [intent.amount] } as const;
      await client.simulateContract(q);
      return withGasMargin(await client.estimateContractGas(q));
    }
    case "wrapToken": {
      tokenOf(intent.asset);
      const q = { ...base, abi: erc20WrapperAbi, functionName: "wrap", args: [intent.amount] } as const;
      await client.simulateContract(q);
      return withGasMargin(await client.estimateContractGas(q));
    }
    case "setHeirs": {
      const q = { ...base, abi: wrapperAbi, functionName: "setHeirs", args: [[...intent.wallets], [...intent.bps]] } as const;
      await client.simulateContract(q);
      return withGasMargin(await client.estimateContractGas(q));
    }
    case "setRecoveryUsers": {
      const q = { ...base, abi: wrapperAbi, functionName: "setRecoveryUsers", args: [[...intent.wallets]] } as const;
      await client.simulateContract(q);
      return withGasMargin(await client.estimateContractGas(q));
    }
    case "startInheritance":
    case "executeInheritance":
    case "executeInheritanceRemaining":
    case "startRecovery":
    case "executeRecovery": {
      const q = { ...base, abi: wrapperAbi, functionName: intent.kind, args: [intent.owner] } as const;
      await client.simulateContract(q);
      return withGasMargin(await client.estimateContractGas(q));
    }
    case "approve": {
      // Without decoding with the ABI (approve is declared without outputs): empty or true is accepted and false is rejected.
      const token = tokenOf(intent.asset);
      const data = encodeFunctionData({ abi: erc20ApproveAbi, functionName: "approve", args: [intent.asset.address, intent.amount] });
      const r = await client.call({ account, to: token.address, data });
      if (!approveReturnOk(r.data)) throw new TxStop(t("tx.wontApprove", { symbol: token.symbol }));
      return withGasMargin(await client.estimateGas({ account, to: token.address, data }));
    }
  }
}

async function send(config: ReturnType<typeof useConfig>, account: Address, intent: TxIntent, gas: bigint): Promise<Hash> {
  const base = { account, chainId: chain.id, address: intent.asset.address, gas } as const;
  switch (intent.kind) {
    case "checkActivity":
      return writeContract(config, { ...base, abi: wrapperAbi, functionName: "checkActivity" });
    case "wrapEth":
      if (intent.asset.underlying.kind !== "native") throw new Error("Not the ETH wrapper");
      return writeContract(config, { ...base, abi: ethWrapperAbi, functionName: "wrap", value: intent.value });
    case "unwrap":
      return writeContract(config, { ...base, abi: wrapperAbi, functionName: "unwrap", args: [intent.amount] });
    case "wrapToken":
      tokenOf(intent.asset);
      return writeContract(config, { ...base, abi: erc20WrapperAbi, functionName: "wrap", args: [intent.amount] });
    case "setHeirs":
      return writeContract(config, { ...base, abi: wrapperAbi, functionName: "setHeirs", args: [[...intent.wallets], [...intent.bps]] });
    case "setRecoveryUsers":
      return writeContract(config, { ...base, abi: wrapperAbi, functionName: "setRecoveryUsers", args: [[...intent.wallets]] });
    case "startInheritance":
    case "executeInheritance":
    case "executeInheritanceRemaining":
    case "startRecovery":
    case "executeRecovery":
      return writeContract(config, { ...base, abi: wrapperAbi, functionName: intent.kind, args: [intent.owner] });
    case "approve":
      // The spender is ALWAYS the wrapper of the asset (address of the manifest, verified at startup).
      return writeContract(config, {
        ...base,
        address: tokenOf(intent.asset).address,
        abi: erc20ApproveAbi,
        functionName: "approve",
        args: [intent.asset.address, intent.amount],
      });
  }
}

/** After setHeirs or setRecoveryUsers: the list on the chain is exactly the one signed (same order and values). */
async function listMatches(
  c: PublicClient,
  account: Address,
  intent: Extract<TxIntent, { kind: "setHeirs" | "setRecoveryUsers" }>,
): Promise<boolean> {
  const same = (a: readonly Address[], b: readonly Address[]) => a.length === b.length && a.every((x, i) => isAddressEqual(x, b[i] ?? "0x0000000000000000000000000000000000000000"));
  if (intent.kind === "setHeirs") {
    const [wallets, pcts] = await c.readContract({ address: intent.asset.address, abi: wrapperAbi, functionName: "getHeirs", args: [account] });
    return same(wallets, intent.wallets) && pcts.length === intent.bps.length && pcts.every((p, i) => p === intent.bps[i]);
  }
  const users = await c.readContract({ address: intent.asset.address, abi: wrapperAbi, functionName: "getRecoveryUsers", args: [account] });
  return same(users, intent.wallets);
}

/** Error with the transaction already sent (there is a hash): its result could not be confirmed or was different from the expected one. */
class SentError extends Error {
  constructor(
    readonly hash: Hash,
    message: string,
  ) {
    super(message);
  }
}

const STEP_TEXT: Record<WrapStep, (amount: string, symbol: string) => string> = {
  reset: (_a, s) => t("tx.stepReset", { symbol: s }),
  approve: (a, s) => t("tx.stepApprove", { amount: a, symbol: s }),
  wrap: (a, s) => t("tx.stepWrap", { amount: a, symbol: s }),
};

export function useTx(account: Address | undefined): TxController {
  const config = useConfig();
  const client = usePublicClient();
  const queryClient = useQueryClient();
  const connection = useConnection();
  // The state stores which account it is for: if the wallet changes account, the previous result stops being shown.
  const [state, setState] = useState<{ account: Address | undefined; phase: TxPhase }>({ account: undefined, phase: { kind: "idle" } });
  // It avoids two transactions at the same time even if it is pressed twice before React paints again.
  const running = useRef(false);
  const chainOk = connection.status === "connected" && connection.chainId === chain.id;

  /** Common checks before starting; returns the client if it is possible to continue. */
  const begin = useCallback(
    (label: string): PublicClient | undefined => {
      if (running.current) return undefined;
      const fail = (message: string) => {
        setState({ account, phase: { kind: "failed", label, message } });
      };
      if (account === undefined || client === undefined) {
        fail(t("tx.connectFirst"));
        return undefined;
      }
      if (!chainOk) {
        fail(t("tx.wrongChain"));
        return undefined;
      }
      running.current = true;
      return client;
    },
    [account, client, chainOk],
  );

  /** A complete transaction (steps 2 to 6). Throws TxStop, SentError or the original error. */
  const execute = useCallback(
    async (c: PublicClient, acct: Address, label: string, intent: TxIntent): Promise<Hash> => {
      const setPhase = (phase: TxPhase) => {
        setState({ account: acct, phase });
      };
      setPhase({ kind: "checking", label });
      const gas = await simulate(c, acct, intent);
      setPhase({ kind: "wallet", label });
      const hash = await send(config, acct, intent, gas);
      setPhase({ kind: "pending", label, hash });
      // Only the receipt of this hash is asked for, until it exists or the time limit passes (src/web3/receipt.ts).
      const result = await waitForReceipt(c, hash);
      if (result === "timeout") throw new SentError(hash, t("tx.unconfirmed"));
      if (result === "reverted") throw new SentError(hash, t("tx.reverted"));
      if (intent.kind === "approve") {
        const token = tokenOf(intent.asset);
        let now: bigint;
        try {
          now = await readAllowance(c, acct, intent.asset);
        } catch {
          throw new SentError(hash, t("tx.approvalUnreadable"));
        }
        if (now !== intent.amount) {
          const f = (v: bigint) => `${formatExact(v, token.decimals)} ${token.symbol}`;
          throw new SentError(hash, t("tx.approvalMismatch", { actual: f(now), expected: f(intent.amount) }));
        }
      }
      if (intent.kind === "setHeirs" || intent.kind === "setRecoveryUsers") {
        let same: boolean;
        try {
          same = await listMatches(c, acct, intent);
        } catch {
          throw new SentError(hash, t("tx.listUnreadable"));
        }
        if (!same) throw new SentError(hash, t("tx.listMismatch"));
      }
      await queryClient.invalidateQueries({ queryKey: ["inheritfi", "snapshot"] });
      return hash;
    },
    [config, queryClient],
  );

  const finish = useCallback(
    (acct: Address, label: string, e: unknown, note = "", role: "owner" | "heir" | "contact" = "owner") => {
      const phase: TxPhase =
        e instanceof SentError
          ? { kind: "failed", label, hash: e.hash, message: `${e.message}${note}` }
          : e instanceof TxStop
            ? { kind: "failed", label, message: `${e.message}${note}` }
            : { kind: "failed", label, message: `${describeTxError(e, role)}${note}` };
      setState({ account: acct, phase });
      // What was already done in previous steps may have changed the plan: it is read again.
      void queryClient.invalidateQueries({ queryKey: ["inheritfi", "snapshot"] });
    },
    [queryClient],
  );

  const run = useCallback(
    async (label: string, intent: TxIntent) => {
      const c = begin(label);
      if (c === undefined || account === undefined) return;
      try {
        const hash = await execute(c, account, label, intent);
        setState({ account, phase: { kind: "done", label, hash } });
      } catch (e) {
        finish(account, label, e, "", roleOf(intent.kind));
      } finally {
        running.current = false;
      }
    },
    [account, begin, execute, finish],
  );

  const wrapToken = useCallback(
    async (label: string, asset: DeployedAsset, amount: bigint) => {
      const c = begin(label);
      if (c === undefined || account === undefined) return;
      let done = 0;
      let total = 0;
      try {
        const token = tokenOf(asset);
        const f = formatExact(amount, token.decimals);
        setState({ account, phase: { kind: "checking", label } });
        const [allowance, balance] = await Promise.all([
          readAllowance(c, account, asset),
          c.readContract({ address: token.address, abi: erc20ReadAbi, functionName: "balanceOf", args: [account] }),
        ]);
        if (balance < amount) throw new TxStop(t("tx.notEnoughToken", { symbol: token.symbol }));
        const steps = planWrapSteps(allowance, amount);
        total = steps.length;
        let hash: Hash | undefined;
        for (const [i, step] of steps.entries()) {
          const stepLabel = steps.length === 1 ? label : t("tx.stepLabel", { label, n: i + 1, total: steps.length, step: STEP_TEXT[step](f, token.symbol) });
          if (step === "wrap") {
            // Right before wrapping, the real approval must be exactly the amount.
            const now = await readAllowance(c, account, asset);
            if (now !== amount) throw new TxStop(t("tx.approvalChanged", { amount: formatExact(now, token.decimals), symbol: token.symbol }));
            hash = await execute(c, account, stepLabel, { kind: "wrapToken", asset, amount });
          } else {
            hash = await execute(c, account, stepLabel, { kind: "approve", asset, amount: expectedAllowanceAfter(step, amount) });
          }
          done = i + 1;
        }
        if (hash === undefined) throw new Error("No steps");
        setState({ account, phase: { kind: "done", label, hash } });
      } catch (e) {
        finish(account, label, e, done > 0 ? ` ${t("tx.earlierSteps", { done, total })}` : "");
      } finally {
        running.current = false;
      }
    },
    [account, begin, execute, finish],
  );

  const runSequence = useCallback(
    async (label: string, intents: readonly SequenceIntent[]) => {
      const c = begin(label);
      if (c === undefined || account === undefined) return;
      const n = intents.length;
      let done = 0;
      try {
        if (n === 0) throw new TxStop(t("tx.nothingToSend"));
        let hash: Hash | undefined;
        for (const [i, intent] of intents.entries()) {
          hash = await execute(c, account, t("tx.sequenceItem", { label, n: i + 1, total: n, symbol: intent.asset.iToken.symbol }), intent);
          done = i + 1;
        }
        if (hash === undefined) throw new Error("No steps");
        setState({ account, phase: { kind: "done", label: t("tx.sequenceDone", { label, n }), hash } });
      } catch (e) {
        // done: completed before the one that failed; after: those that remained behind and were not sent.
        const after = n - done - 1;
        const before = done > 0 ? ` ${t("tx.completedBefore", { done, total: n })}` : "";
        const rest = after > 0 ? ` ${t("tx.notSentAfter", { count: after })}` : "";
        const note = n === 0 ? "" : before + rest;
        finish(account, label, e, note, roleOf(intents[0]?.kind ?? "startInheritance"));
      } finally {
        running.current = false;
      }
    },
    [account, begin, execute, finish],
  );

  const ethMax = useCallback(
    async (asset: DeployedAsset, balance: bigint): Promise<EthMax> => {
      if (account === undefined || client === undefined) return { ok: false, text: t("wrap.maxNoEstimate") };
      return readEthMax(client, account, asset, balance);
    },
    [account, client],
  );

  const dismiss = useCallback(() => {
    if (!running.current) setState({ account: undefined, phase: { kind: "idle" } });
  }, []);

  const phase: TxPhase = state.account === account || isBusy(state.phase) ? state.phase : { kind: "idle" };
  return { phase, busy: isBusy(phase), chainOk, run, wrapToken, runSequence, ethMax, dismiss };
}
