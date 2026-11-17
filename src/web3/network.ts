import { defineChain } from "viem";
import { deployment } from "@deployment";
import type { Deployment } from "../contracts/types";
import type { ClockMode } from "../lib/time";

/** Deployment data of the environment chosen at build time (INHERITFI_ENV), without the literal types. */
export const deploymentInfo: Deployment = deployment;

/**
 * RPC node of this build. vite.config.ts writes it at build time (rpcUrlFor in endpoints.ts, with INHERITFI_ENV),
 * so the bundle carries only the address of its own environment, never those of the others.
 */
declare const __INHERITFI_RPC_URL__: string;
export const rpcUrl: string = __INHERITFI_RPC_URL__;

/**
 * What "now" is when comparing with the contract periods (the periods are reached according to the time of the blocks).
 * "block": only the time of the block read (the browser's clock is never queried).
 */
export const CLOCK_MODE: Record<Deployment["env"], ClockMode> = {
  mainnet: "block",
};

/** How often the plan is read again (a single eth_call per read): one block (~12 s). */
export const POLL_MS: Record<Deployment["env"], number> = {
  mainnet: 12_000,
};

export const clockMode = CLOCK_MODE[deploymentInfo.env];
export const pollMs = POLL_MS[deploymentInfo.env];

/** The only chain that the interface accepts: the one of the manifest. */
export const chain = defineChain({
  id: deploymentInfo.chainId,
  name: "Ethereum",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: false,
});
