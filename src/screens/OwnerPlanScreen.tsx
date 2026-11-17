import { useState } from "react";
import type { Address } from "viem";
import type { DeployedAsset } from "../contracts/types";
import { Button } from "../components/Button";
import { Notice } from "../components/Notice";
import { ShareOwnerLink } from "../components/ShareOwnerLink";
import { TxStatus } from "../components/TxStatus";
import { anyInProgress, confirmAllTargets, CONFIRM_ALL_MIN } from "../lib/confirmAll";
import { effectiveNow } from "../lib/time";
import { clockMode, deploymentInfo } from "../web3/network";
import { sortOverview } from "../web3/plan";
import { useClock } from "../web3/useClock";
import { useSnapshot } from "../web3/useSnapshot";
import type { TxController } from "../web3/useTx";
import { AssetPicker } from "./AssetPicker";
import { OwnerPlan } from "./OwnerPlan";
import { currentLocale, t } from "../i18n";

interface OwnerPlanScreenProps {
  account: Address | undefined;
  tx: TxController;
}

const firstAsset: DeployedAsset = (() => {
  const a = deploymentInfo.assets[0];
  if (a === undefined) throw new Error("The deployment has no assets");
  return a;
})();

/** Owner screen: chooses the asset and reads its plan from the contract. Without a connected account it shows no data. */
export function OwnerPlanScreen({ account, tx }: OwnerPlanScreenProps) {
  const clock = useClock(clockMode);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  // Initial asset: the first one with balance or a plan according to the first read of that account; it is fixed once per account
  // so that the screen does not change asset on its own. Before that read, the first one of the manifest is read.
  const [auto, setAuto] = useState<{ account: Address; ticker: string } | undefined>(undefined);
  const autoTicker = auto !== undefined && auto.account === account ? auto.ticker : undefined;
  const selected = deploymentInfo.assets.find((a) => a.ticker === (chosen ?? autoTicker)) ?? firstAsset;

  // A single active query: one eth_call per read.
  const snapshot = useSnapshot(selected, account);
  const data = snapshot.data;
  if (account !== undefined && autoTicker === undefined && data !== undefined && !snapshot.isPlaceholderData && data.account === account) {
    setAuto({ account, ticker: sortOverview(data.overview)[0]?.asset.ticker ?? firstAsset.ticker });
  }
  const rows = data !== undefined && data.account === account ? sortOverview(data.overview) : [];
  // The plan is only shown if the read belongs to the chosen asset and account (not a previous read that was kept).
  const current = data !== undefined && !snapshot.isPlaceholderData && data.ticker === selected.ticker && data.account === account ? data : undefined;
  // "Confirm I'm active in all": assets with balance or a plan, first those with a process in progress (src/lib/confirmAll.ts).
  const targets = confirmAllTargets(rows);
  const blocked = !tx.chainOk ? t("blocked.network") : tx.busy ? t("blocked.busy") : null;

  return (
    <div className="screen">
      <header>
        <h1 className="screen__title">{t("planScreen.title")}</h1>
        <p className="screen__sub">{t("planScreen.sub")}</p>
      </header>

      {account === undefined ? (
        <Notice tone="info" title={t("common.connectTitle")}>
          {t("planScreen.connect")}
        </Notice>
      ) : snapshot.isError ? (
        <>
          <Notice tone="error" title={t("planScreen.readErrorTitle")}>
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
        </>
      ) : (
        <>
          {rows.length > 0 && (
            <div className="screen__toolbar">
              <AssetPicker rows={rows} selected={selected.ticker} onSelect={setChosen} />
              {rows.some((r) => r.hasPlan) && <ShareOwnerLink account={account} />}
              {targets.length >= CONFIRM_ALL_MIN && (
                <Button
                  variant="primary"
                  disabled={blocked !== null}
                  title={blocked ?? undefined}
                  onClick={() => {
                    void tx.runSequence(
                      t("planScreen.confirmAll"),
                      targets.map((r) => ({ kind: "checkActivity", asset: r.asset })),
                    );
                  }}
                >
                  {t("planScreen.confirmAllButton", { count: targets.length })}
                </Button>
              )}
            </div>
          )}
          {targets.length >= CONFIRM_ALL_MIN && (
            <p className="screen__note screen__note--tight">
              {t("bulk.note")}
              {anyInProgress(targets) && ` ${t("planScreen.confirmAllFirst")}`}
            </p>
          )}
          <TxStatus phase={tx.phase} onDismiss={tx.dismiss} />
          {current === undefined ? (
            <Notice tone="info" title={t("planScreen.readingTitle")}>
              {t("common.reading")}
            </Notice>
          ) : (
            <OwnerPlan
              key={`${account}-${selected.ticker}`}
              account={account}
              asset={selected}
              plan={current.plan}
              params={current.params}
              now={effectiveNow(clockMode, current.blockTimestamp, () => {
                if (clock === null) throw new Error("No clock in this mode");
                return clock;
              })}
              walletEth={current.walletEth}
              underlying={current.underlying}
              isTreasury={current.isTreasury}
              tx={tx}
              locale={currentLocale()}
            />
          )}
        </>
      )}
    </div>
  );
}
