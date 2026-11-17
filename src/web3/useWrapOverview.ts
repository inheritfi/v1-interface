import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import type { DeployedAsset } from "../contracts/types";
import { deploymentInfo, pollMs } from "./network";
import { readWrapOverview } from "./wrapOverview";

/**
 * Balances of the 29 assets and fees of the chosen one: a single eth_call per read. The key starts with
 * ["inheritfi", "snapshot"] so that useTx invalidates it after each transaction, the same as the plan's.
 */
export function useWrapOverview(selected: DeployedAsset, account: Address | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["inheritfi", "snapshot", "wrap", deploymentInfo.manifestSha256, selected.ticker, account],
    queryFn: () => {
      if (client === undefined) throw new Error("No client for the configured chain");
      if (account === undefined) throw new Error("No account");
      return readWrapOverview(client, deploymentInfo.assets, selected, account);
    },
    enabled: account !== undefined,
    refetchInterval: pollMs,
    // When the asset changes, the previous read is kept only for the list; the forms are shown
    // only if the read belongs to the chosen asset and account (see WrapScreen).
    placeholderData: keepPreviousData,
  });
}
