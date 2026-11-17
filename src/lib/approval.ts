/**
 * INHERITFI: steps to wrap an ERC-20 with EXACT approval:
 *   - current approval = amount       → only wrap (wrap consumes it and it stays at 0);
 *   - current approval = 0            → approve(amount), wrap;
 *   - any other one (lower or higher) → approve(0), approve(amount), wrap.
 * Never an unlimited approval or one different from the amount. Going through 0 is what CRV and LDO require (C3) and it applies to
 * the 28 tokens equally.
 */
export type WrapStep = "reset" | "approve" | "wrap";

export function planWrapSteps(allowance: bigint, amount: bigint): WrapStep[] {
  if (amount <= 0n) throw new Error("Amount must be greater than zero");
  if (allowance < 0n) throw new Error("Invalid allowance");
  if (allowance === amount) return ["wrap"];
  if (allowance === 0n) return ["approve", "wrap"];
  return ["reset", "approve", "wrap"];
}

/** Approval that must remain on the chain after each approval step. */
export function expectedAllowanceAfter(step: Exclude<WrapStep, "wrap">, amount: bigint): bigint {
  return step === "reset" ? 0n : amount;
}

/**
 * Interprets what approve returned in the simulation without depending on the ABI: empty (tokens that return nothing) or
 * exactly `true` is acceptable; `false` or anything else is not.
 */
export function approveReturnOk(data: `0x${string}` | undefined): boolean {
  if (data === undefined || data === "0x") return true;
  return data === `0x${"0".repeat(63)}1`;
}
