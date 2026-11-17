import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import type { DeployedAsset } from "../contracts/types";
import { readContactOverview } from "./contactReads";
import { deploymentInfo, pollMs } from "./network";

/**
 * Overview of the contact: the detail of all the assets where the account is a contact of the owner (one
 * eth_call). The panel of the chosen asset uses this same data. The key starts with "snapshot": useTx invalidates it
 * after each transaction.
 */
export function useContactOverview(assets: readonly DeployedAsset[] | undefined, owner: Address | undefined, me: Address | undefined) {
  const client = usePublicClient();
  const key = assets?.map((a) => a.ticker).join(",");
  return useQuery({
    queryKey: ["inheritfi", "snapshot", "contact-overview", deploymentInfo.manifestSha256, owner, me, key],
    queryFn: () => {
      if (client === undefined) throw new Error("No client for the configured chain");
      if (assets === undefined || owner === undefined || me === undefined) throw new Error("Missing input");
      return readContactOverview(client, assets, owner, me);
    },
    enabled: assets !== undefined && assets.length > 0 && owner !== undefined && me !== undefined,
    refetchInterval: pollMs,
    placeholderData: keepPreviousData,
  });
}
