/**
 * INHERITFI: margin over the gas estimate.
 *
 * The contracts store the time of the last activity (activityTimestamp = block.timestamp). The node estimates the gas
 * with the time of the last block; if the account's last activity was in that same block (for example, wrapping and
 * right away confirming activity), in the estimate the stored value does not change (cheap write), but when it executes
 * in the next block it does change and costs ~2 800 more gas: the transaction runs out of gas and reverts.
 * Checked in the replica: estimate 35 045, real gas 37 845 (checkActivity). With +25 % there is spare in every case of
 * I3d-1; unused gas is not charged.
 */
export function withGasMargin(estimate: bigint): bigint {
  if (estimate <= 0n) throw new Error("Invalid gas estimate");
  return estimate + (estimate + 3n) / 4n;
}

/**
 * INHERITFI: "Max" when wrapping ETH. Reserve for the network fee = gas limit (already with margin, the same one that is
 * sent to the wallet) × estimated max price × 2 (price increases and difference with the one the wallet sets). The network
 * only charges the gas used: whatever is left of the reserve stays in the wallet. null if the balance does not cover the reserve.
 */
export function ethMaxAfterReserve(balance: bigint, gasLimit: bigint, maxFeePerGas: bigint): { amount: bigint; reserve: bigint } | null {
  if (balance < 0n || gasLimit <= 0n || maxFeePerGas <= 0n) throw new Error("Invalid input");
  const reserve = gasLimit * maxFeePerGas * 2n;
  return balance > reserve ? { amount: balance - reserve, reserve } : null;
}
