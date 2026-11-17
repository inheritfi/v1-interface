import type { Deployment } from "../contracts/types";

/**
 * RPC node of each environment. The manifests carry no URLs on purpose; they are set here.
 * Mainnet: the INHERITFI RPC intermediary. Only vite.config.ts reads this table, at build time.
 */
const RPC_URLS: Record<Deployment["env"], string | null> = {
  mainnet: "https://rpc.inheritfi.com",
};

export function rpcUrlFor(env: Deployment["env"]): string {
  const url = RPC_URLS[env];
  if (url === null) {
    throw new Error(`No RPC endpoint is configured for ${env}`);
  }
  return url;
}
