import { QueryClient } from "@tanstack/react-query";
import { createConfig, http, type CreateConnectorFn } from "wagmi";
import { chain, rpcUrl } from "./network";

/**
 * wagmi configuration: a single chain (the one of the manifest) and a single RPC. The wallets are the ones announced
 * by the browser extensions (EIP-6963); the dialog lists them as wallets.ts decides. No CCIP and no connectors that
 * call external services (no wallet SDK, no WalletConnect).
 */
export const wagmiConfig = createConfig({
  chains: [chain],
  // Typed on purpose: an empty literal would be inferred as `never` and the connectors would lose their type.
  connectors: [] as CreateConnectorFn[],
  multiInjectedProviderDiscovery: true,
  // No CCIP reads (EIP-3668): a contract cannot make the browser query external URLs.
  ccipRead: false,
  transports: { [chain.id]: http(rpcUrl, { batch: true }) },
  // wagmi groups the reads in Multicall3 on its own by default (batch.multicall, batches of 1024 bytes).
  // It is disabled: the interface makes its own single call to aggregate3 per read (src/web3/plan.ts).
  batch: { multicall: false },
  pollingInterval: 4_000,
});

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
