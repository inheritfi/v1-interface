import type { DeployedAsset } from "../contracts/types";

/**
 * "Confirm I'm active in all": checkActivity in each asset
 * with balance or with a plan, one transaction per asset (useTx.runSequence).
 *
 * The contract only accepts checkActivity from an owner (onlyTestator: activityTimestamp > 0 or balance > 0); an asset without
 * balance or plan is not confirmed (it would only spend gas without protecting anything).
 *
 * Order: first the assets with a started recovery and then those with a started inheritance (confirming
 * cancels them: InheritfiV1InheritanceLib.checkActivity); then the rest, from the oldest activity to the most
 * recent. Ties: order of the manifest.
 */
export interface ConfirmRow {
  asset: DeployedAsset;
  balance: bigint;
  /** It has heirs or contacts configured. */
  hasPlan: boolean;
  activityTimestamp: bigint;
  inheritanceStarted: boolean;
  recoveryStarted: boolean;
}

/** Button visible only with 2 or more assets to confirm (with one, the button of its panel is enough). */
export const CONFIRM_ALL_MIN = 2;

const urgency = (r: ConfirmRow): number => (r.recoveryStarted ? 0 : r.inheritanceStarted ? 1 : 2);

/** Assets to confirm, in the order in which they are signed. */
export function confirmAllTargets(rows: readonly ConfirmRow[]): ConfirmRow[] {
  const eligible = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => (row.balance > 0n || row.hasPlan) && (row.activityTimestamp > 0n || row.balance > 0n));
  eligible.sort((a, b) => {
    const u = urgency(a.row) - urgency(b.row);
    if (u !== 0) return u;
    if (urgency(a.row) === 2 && a.row.activityTimestamp !== b.row.activityTimestamp) {
      return a.row.activityTimestamp < b.row.activityTimestamp ? -1 : 1;
    }
    return a.index - b.index;
  });
  return eligible.map(({ row }) => row);
}

/** Some asset that is going to be confirmed has a recovery or an inheritance in progress (additional note). */
export const anyInProgress = (targets: readonly ConfirmRow[]): boolean => targets.some((r) => r.recoveryStarted || r.inheritanceStarted);
