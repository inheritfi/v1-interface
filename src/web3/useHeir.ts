import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { readOverview, readRoles, type OverviewItem } from "./heirReads";
import { deploymentInfo, pollMs } from "./network";

/** Roles of the connected account with respect to an owner in the 29 assets (one eth_call). Key invalidated by useTx. */
export function useRoles(owner: Address | undefined, me: Address | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["inheritfi", "snapshot", "roles", deploymentInfo.manifestSha256, owner, me],
    queryFn: () => {
      if (client === undefined) throw new Error("No client for the configured chain");
      if (owner === undefined || me === undefined) throw new Error("No owner or account");
      return readRoles(client, deploymentInfo.assets, owner, me);
    },
    enabled: owner !== undefined && me !== undefined,
    refetchInterval: pollMs,
  });
}

/**
 * Overview: the detail of all the assets where the account is an heir (one eth_call). The panel of the chosen asset
 * uses this same data, so the list and the panel never contradict each other.
 */
export function useHeirOverview(items: readonly OverviewItem[] | undefined, owner: Address | undefined, me: Address | undefined) {
  const client = usePublicClient();
  const key = items?.map((it) => `${it.asset.ticker}:${it.heirs.join(",")}`).join(";");
  return useQuery({
    queryKey: ["inheritfi", "snapshot", "heir-overview", deploymentInfo.manifestSha256, owner, me, key],
    queryFn: () => {
      if (client === undefined) throw new Error("No client for the configured chain");
      if (items === undefined || owner === undefined || me === undefined) throw new Error("Missing input");
      return readOverview(client, items, owner, me);
    },
    enabled: items !== undefined && items.length > 0 && owner !== undefined && me !== undefined,
    refetchInterval: pollMs,
    placeholderData: keepPreviousData,
  });
}
