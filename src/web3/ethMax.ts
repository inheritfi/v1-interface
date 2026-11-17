import type { Address, PublicClient } from "viem";
import type { DeployedAsset } from "../contracts/types";
import { ethMaxAfterReserve, withGasMargin } from "../lib/gas";
import { ethWrapperAbi } from "./abis";
import { t } from "../i18n";

export type EthMax = { ok: true; amount: bigint; reserve: bigint; gasLimit: bigint; maxFeePerGas: bigint } | { ok: false; text: string };

/**
 * "Max" when wrapping ETH, read on our node: the balance minus the reserve for the network fee
 * (ethMaxAfterReserve). The gas of wrap does not depend on the amount: it is estimated with half of the balance, a valid
 * and available amount; the limit carries the same margin that is sent to the wallet.
 */
export async function readEthMax(client: PublicClient, account: Address, asset: DeployedAsset, balance: bigint): Promise<EthMax> {
  if (asset.underlying.kind !== "native" || balance <= 0n) return { ok: false, text: t("wrap.maxNoEstimate") };
  try {
    const q = { account, address: asset.address, abi: ethWrapperAbi, functionName: "wrap", value: balance / 2n } as const;
    const gasLimit = withGasMargin(await client.estimateContractGas(q));
    const { maxFeePerGas } = await client.estimateFeesPerGas();
    const r = ethMaxAfterReserve(balance, gasLimit, maxFeePerGas);
    return r === null ? { ok: false, text: t("wrap.maxNoRoom") } : { ok: true, amount: r.amount, reserve: r.reserve, gasLimit, maxFeePerGas };
  } catch {
    return { ok: false, text: t("wrap.maxNoEstimate") };
  }
}
