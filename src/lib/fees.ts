/**
 * INHERITFI: protocol fee, computed the same way as the contract.
 * InheritfiV1Base._taxSplit (InheritfiV1Base.sol): tax = (amount * rate) / BP; net = amount - tax; BP = 10 000.
 * Integer division truncates, so the fee is never rounded up.
 */
export const BP = 10_000n;

export interface FeeSplit {
  fee: bigint;
  net: bigint;
}

export function splitFee(amount: bigint, rateBps: bigint): FeeSplit {
  if (amount < 0n) throw new Error("Negative amount");
  if (rateBps < 0n || rateBps > BP) throw new Error("Invalid fee rate");
  const fee = (amount * rateBps) / BP;
  return { fee, net: amount - fee };
}
