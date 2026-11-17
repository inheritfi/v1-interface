import type { TxPhase } from "../web3/useTx";
import { Button } from "./Button";
import { Notice } from "./Notice";
import { t } from "../i18n";
import { rich } from "../i18n/rich";

/** State of the transaction in progress or of the last one; the hash always complete and left to right. */
export function TxStatus({ phase, onDismiss }: { phase: TxPhase; onDismiss: () => void }) {
  if (phase.kind === "idle") return null;
  const hashValue = phase.kind === "pending" || phase.kind === "done" || phase.kind === "failed" ? phase.hash : undefined;
  const hash =
    hashValue !== undefined ? (
      <>
        {" "}
        {rich("tx.hash", { hash: <bdi className="ui-mono ui-hash" dir="ltr">{hashValue}</bdi> })}
      </>
    ) : null;
  switch (phase.kind) {
    case "checking":
      return <Notice tone="info" title={t("tx.checkingTitle", { label: phase.label })}>{t("tx.checking")}</Notice>;
    case "wallet":
      return <Notice tone="info" title={t("tx.walletTitle", { label: phase.label })}>{t("tx.wallet")}</Notice>;
    case "pending":
      return (
        <Notice tone="info" title={t("tx.pendingTitle", { label: phase.label })}>
          {t("tx.pending")}
          {hash}
        </Notice>
      );
    case "done":
      return (
        <div className="ui-tx">
          <Notice tone="info" title={t("tx.doneTitle", { label: phase.label })}>
            {t("tx.done")}
            {hash}
          </Notice>
          <Button onClick={onDismiss}>{t("common.ok")}</Button>
        </div>
      );
    case "failed":
      return (
        <div className="ui-tx">
          <Notice tone="error" title={t("tx.failedTitle", { label: phase.label })}>
            {phase.message}
            {hash}
          </Notice>
          <Button onClick={onDismiss}>{t("common.ok")}</Button>
        </div>
      );
  }
}
