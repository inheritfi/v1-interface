import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import type { DeployedAsset } from "../contracts/types";
import { deploymentInfo, pollMs } from "./network";
import { readSnapshot } from "./plan";

/** Plan and parameters of the chosen asset, summary of the 29 assets and block time: a single eth_call per read. */
export function useSnapshot(selected: DeployedAsset, account: Address | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["inheritfi", "snapshot", deploymentInfo.manifestSha256, selected.ticker, account],
    queryFn: () => {
      if (client === undefined) throw new Error("No client for the configured chain");
      if (account === undefined) throw new Error("No account");
      return readSnapshot(client, deploymentInfo.assets, selected, account);
    },
    enabled: account !== undefined,
    refetchInterval: pollMs,
    // When the asset changes, the previous read is kept only for the summary of the selector; the plan is shown
    // only if the read belongs to the chosen asset and account (see OwnerPlanScreen).
    placeholderData: keepPreviousData,
  });
}
