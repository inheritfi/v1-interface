// INHERITFI: what an heir can do in an asset, derived from what the contract returns.
// Rules of v1-core (InheritfiV1InheritanceLib.sol, MD5 100f1247…):
//  - startInheritance (l. 108-132): no inheritance in progress; if there is a recovery in progress, only when its
//    window expired (startRecoveryTimestamp + recoveryExecutionWindow); with heirs; activityTimestamp +
//    inheritInactivityPeriod reached; owner's balance > 0.
//  - executeInheritance (l. 143-172): inheritance started; the heir did not claim; claims not closed;
//    startInheritanceTimestamp + inheritWaitingTime reached.
//  - executeInheritanceRemaining (l. 180-250): the heir already claimed; inheritance started; + inheritRemainingWaitingTime
//    reached; balance > 0. It closes the claims and splits the balance only among those who claimed.
//  - getHeirInheritanceInfo / heirPotentials (l. 289-335): `potential` (net) is what it would claim now if it has not claimed
//    and the claims are not closed; `potentialRemaining` (net) is what it would get from the rest, only from when it can.
// Times in Unix seconds (bigint); percentages in basis points.

export interface OwnerAssetReads {
  balance: bigint;
  activityTimestamp: bigint;
  inheritanceStarted: boolean;
  inheritanceStartTimestamp: bigint;
  recoveryStarted: boolean;
  recoveryStartTimestamp: bigint;
  inheritanceClaimsClosed: boolean;
}

export interface HeirParams {
  inheritInactivityPeriod: bigint;
  inheritWaitingTime: bigint;
  inheritRemainingWaitingTime: bigint;
  recoveryExecutionWindow: bigint;
  inheritanceTax: bigint;
}

/** getHeirInheritanceInfo of each heir of the owner in that asset. */
export interface HeirInfo {
  wallet: `0x${string}`;
  bps: bigint;
  released: bigint;
  received: boolean;
  potential: bigint;
  potentialRemaining: bigint;
}

export type HeirStatus =
  /** A recovery contact started a recovery: the inheritance cannot start until `blockedUntil`. */
  | { kind: "recovery-active"; recoveryStartedAt: bigint; blockedUntil: bigint }
  /** The owner is still active: the inheritance can start from `canStartAt`. */
  | { kind: "waiting"; lastActivity: bigint; canStartAt: bigint }
  /** The period passed but the owner has no balance in this asset: there is nothing to inherit. */
  | { kind: "no-balance" }
  /** Any heir can start the inheritance. */
  | { kind: "can-start"; lastActivity: bigint }
  /** Inheritance started; the claims open at `claimsFrom`. `estimate`: what it would claim with today's balance. */
  | { kind: "started"; startedAt: bigint; claimsFrom: bigint; restFrom: bigint; estimate: bigint }
  /** It can claim its share now; from `restFrom` any heir that already claimed can close the claims. */
  | { kind: "can-claim"; startedAt: bigint; potential: bigint; restFrom: bigint }
  /** It already claimed; from `restFrom` it will be able to claim the rest. */
  | { kind: "claimed"; startedAt: bigint; released: bigint; restFrom: bigint }
  /**
   * It already claimed and can claim the rest. If the claims are still open, claiming it closes them; if they are already closed, it is
   * new remaining funds (the balance arrived after the closing): the process stays started by design (A-03) and the remaining funds are
   * split each time among the heirs that claimed.
   */
  | {
      kind: "can-claim-rest";
      startedAt: bigint;
      released: bigint;
      potentialRemaining: bigint;
      remaining: bigint;
      claimedCount: number;
      unclaimedCount: number;
      claimsClosed: boolean;
    }
  /** It already claimed and there is no balance left to split. */
  | { kind: "done"; released: bigint }
  /** The claims were closed without this heir claiming. */
  | { kind: "missed" };

/** Checks that what was read is consistent before interpreting it. */
export function validateHeirReads(o: OwnerAssetReads, heirs: readonly HeirInfo[], me: string): HeirInfo {
  if (o.inheritanceStarted && o.recoveryStarted) throw new Error("Inconsistent state: inheritance and recovery both started");
  const total = heirs.reduce((s, h) => s + h.bps, 0n);
  if (heirs.length === 0 || total !== 10_000n || heirs.some((h) => h.bps <= 0n)) throw new Error("Inconsistent heirs");
  const mine = heirs.find((h) => h.wallet.toLowerCase() === me.toLowerCase());
  if (mine === undefined) throw new Error("This wallet is not an heir of this owner in this asset");
  if (!o.inheritanceStarted && heirs.some((h) => h.received)) throw new Error("Inconsistent state: claims without an inheritance");
  return mine;
}

export function heirStatus(o: OwnerAssetReads, p: HeirParams, heirs: readonly HeirInfo[], me: string, now: bigint): HeirStatus {
  const mine = validateHeirReads(o, heirs, me);
  if (!o.inheritanceStarted) {
    if (o.recoveryStarted) {
      const blockedUntil = o.recoveryStartTimestamp + p.recoveryExecutionWindow;
      if (now < blockedUntil) return { kind: "recovery-active", recoveryStartedAt: o.recoveryStartTimestamp, blockedUntil };
    }
    const canStartAt = o.activityTimestamp + p.inheritInactivityPeriod;
    if (now < canStartAt) return { kind: "waiting", lastActivity: o.activityTimestamp, canStartAt };
    if (o.balance === 0n) return { kind: "no-balance" };
    return { kind: "can-start", lastActivity: o.activityTimestamp };
  }
  const startedAt = o.inheritanceStartTimestamp;
  const claimsFrom = startedAt + p.inheritWaitingTime;
  const restFrom = claimsFrom + p.inheritRemainingWaitingTime;
  if (!mine.received) {
    if (o.inheritanceClaimsClosed) return { kind: "missed" };
    if (now < claimsFrom) return { kind: "started", startedAt, claimsFrom, restFrom, estimate: mine.potential };
    return { kind: "can-claim", startedAt, potential: mine.potential, restFrom };
  }
  if (now < restFrom) return { kind: "claimed", startedAt, released: mine.released, restFrom };
  if (o.balance === 0n) return { kind: "done", released: mine.released };
  return {
    kind: "can-claim-rest",
    startedAt,
    released: mine.released,
    potentialRemaining: mine.potentialRemaining,
    remaining: o.balance,
    claimedCount: heirs.filter((h) => h.received).length,
    unclaimedCount: heirs.filter((h) => !h.received).length,
    claimsClosed: o.inheritanceClaimsClosed,
  };
}
