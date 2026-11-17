import { useEffect } from "react";
import type { Address } from "viem";
import { Button } from "../components/Button";
import { Notice } from "../components/Notice";
import type { DeployedAsset } from "../contracts/types";
import { entrySection, type Section } from "../lib/section";
import { deploymentInfo } from "../web3/network";
import { useSnapshot } from "../web3/useSnapshot";
import { t } from "../i18n";

const firstAsset: DeployedAsset = (() => {
  const a = deploymentInfo.assets[0];
  if (a === undefined) throw new Error("The deployment has no assets");
  return a;
})();

/**
 * Entry screen according to the account (no section in the URL): reads once the 29 assets of the connected account
 * (the same read the plan opens with) and chooses: some iToken or some plan → the plan; if not, wrap.
 */
export function EntryResolver({ account, onDecide }: { account: Address; onDecide: (s: Section) => void }) {
  const snapshot = useSnapshot(firstAsset, account);
  const data = snapshot.data;
  const ready = data !== undefined && !snapshot.isPlaceholderData && data.account === account ? data : undefined;
  useEffect(() => {
    if (ready !== undefined) onDecide(entrySection(ready.overview));
  }, [ready, onDecide]);

  if (snapshot.isError) {
    return (
      <div className="screen">
        <Notice tone="error" title={t("entry.readErrorTitle")}>
          {t("common.nothingShown")}
        </Notice>
        <div className="ui-actions">
          <Button
            onClick={() => {
              void snapshot.refetch();
            }}
          >
            {t("common.tryAgain")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <Notice tone="info" title={t("entry.readingTitle")}>
      {t("common.reading")}
    </Notice>
  );
}
