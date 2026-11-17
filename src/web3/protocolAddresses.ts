import { multicall3 } from "../contracts/generated/multicall3";
import type { Deployment } from "../contracts/types";
import { deploymentInfo } from "./network";

/**
 * INHERITFI: addresses of the protocol contracts, taken from the manifest verified at startup: wrappers,
 * ERC-20 underlyings, libraries and Multicall3. They cannot be heirs or recovery contacts in the interface
 *: it prevents pasting by mistake the address of a contract instead of that of a wallet.
 */
export function protocolAddressesOf(d: Deployment): string[] {
  return [
    ...d.assets.map((a) => a.address),
    ...d.assets.flatMap((a) => (a.underlying.kind === "erc20" ? [a.underlying.address] : [])),
    ...d.libraries.map((l) => l.address),
    multicall3.address,
  ];
}

export const protocolAddresses: readonly string[] = protocolAddressesOf(deploymentInfo);
