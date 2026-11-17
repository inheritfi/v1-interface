import { useState } from "react";
import type { Address } from "viem";
import { Amount } from "../components/Amount";
import { AssetCombobox } from "../components/AssetCombobox";
import { Button } from "../components/Button";
import { Notice } from "../components/Notice";
import { TxStatus } from "../components/TxStatus";
import { RiskBadge, RiskNotice, WrapControls, type WrapForm } from "../components/WrapControls";
import type { DeployedAsset } from "../contracts/types";
import { formatBasisPoints } from "../lib/format";
import { deploymentInfo } from "../web3/network";
import type { TxController } from "../web3/useTx";
import { useWrapOverview } from "../web3/useWrapOverview";
import { sortWrapRows, type WrapRow } from "../web3/wrapOverview";
import { t } from "../i18n";
import { rich } from "../i18n/rich";

interface WrapScreenProps {
  account: Address | undefined;
  tx: TxController;
}

const firstAsset: DeployedAsset = (() => {
  const a = deploymentInfo.assets[0];
  if (a === undefined) throw new Error("The deployment has no assets");
  return a;
})();

const underlyingSymbol = (a: DeployedAsset) => (a.underlying.kind === "native" ? "ETH" : a.underlying.symbol);

/** Summary of an asset: ticker, risk label, what there is in the wallet, what is wrapped and the current approval. */
function AssetRowView({ row }: { row: WrapRow }) {
  const u = underlyingSymbol(row.asset);
  const d = row.asset.underlying.decimals;
  return (
    <span className="ui-assetrow">
      <span className="ui-assetrow__name">
        <strong>{u}</strong> <RiskBadge ticker={row.asset.ticker} />
      </span>
      <span className="ui-assetrow__nums">
        <span>{rich("wrapScreen.rowWallet", { amount: <Amount value={row.wallet} decimals={d} symbol={u} /> })}</span>
        <span>{rich("wrapScreen.rowWrapped", { amount: <Amount value={row.wrapped} decimals={d} symbol={row.asset.iToken.symbol} /> })}</span>
        {row.allowance !== null && row.allowance > 0n && <span>{rich("wrapScreen.rowApproved", { amount: <Amount value={row.allowance} decimals={d} symbol={u} /> })}</span>}
      </span>
    </span>
  );
}

/**
 * "Wrap and unwrap" screen: on the left, the asset selector (box with its summary; the arrow opens the list
 * of supported assets with search by ticker or iToken); on the right, the detail of the chosen asset.
 */
export function WrapScreen({ account, tx }: WrapScreenProps) {
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  // Initial asset: the first one with something in the wallet, wrapped or approved according to the first read of that account;
  // it is fixed once per account so that the screen does not change asset on its own.
  const [auto, setAuto] = useState<{ account: Address; ticker: string } | undefined>(undefined);
  const autoTicker = auto !== undefined && auto.account === account ? auto.ticker : undefined;
  const selected = deploymentInfo.assets.find((a) => a.ticker === (chosen ?? autoTicker)) ?? firstAsset;
  const [form, setForm] = useState<WrapForm | null>(null);

  // A single active query: one eth_call per read.
  const overview = useWrapOverview(selected, account);
  const data = overview.data;
  if (account !== undefined && autoTicker === undefined && data !== undefined && !overview.isPlaceholderData && data.account === account) {
    setAuto({ account, ticker: sortWrapRows(data.rows)[0]?.asset.ticker ?? firstAsset.ticker });
  }
  const rows = data !== undefined && data.account === account ? sortWrapRows(data.rows) : [];
  // The forms are only shown if the read belongs to the chosen asset and account (not a previous read that was kept).
  const current = data !== undefined && !overview.isPlaceholderData && data.ticker === selected.ticker && data.account === account ? data : undefined;
  const row: WrapRow | undefined = current?.rows.find((r) => r.asset.ticker === selected.ticker);
  const blocked = !tx.chainOk ? t("blocked.network") : tx.busy ? t("blocked.busy") : null;

  const choose = (ticker: string) => {
    if (ticker === selected.ticker) return;
    setChosen(ticker);
    setForm(null);
  };

  return (
    <div className="screen">
      <header>
        <h1 className="screen__title">{t("wrapScreen.title")}</h1>
        <p className="screen__sub">{t("wrapScreen.sub")}</p>
      </header>

      {account === undefined ? (
        <Notice tone="info" title={t("common.connectTitle")}>
          {t("wrapScreen.connect")}
        </Notice>
      ) : overview.isError ? (
        <>
          <Notice tone="error" title={t("wrapScreen.readErrorTitle")}>
            {t("common.nothingShown")}
          </Notice>
          <div className="ui-actions">
            <Button
              onClick={() => {
                void overview.refetch();
              }}
            >
              {t("common.tryAgain")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <TxStatus phase={tx.phase} onDismiss={tx.dismiss} />
          <div className="screen__grid">
            <section className="ui-panel" aria-labelledby="assets">
              <h2 id="assets">{t("wrapScreen.assets")}</h2>
              {rows.length === 0 ? (
                <p className="screen__note">{t("common.reading")}</p>
              ) : (
                <AssetCombobox
                  label={t("picker.asset")}
                  searchLabel={t("picker.search")}
                  items={rows}
                  assetOf={(r) => r.asset}
                  selected={selected.ticker}
                  renderSelected={() => {
                    const r = rows.find((x) => x.asset.ticker === selected.ticker);
                    return r === undefined ? <strong>{underlyingSymbol(selected)}</strong> : <AssetRowView row={r} />;
                  }}
                  renderItem={(r) => <AssetRowView row={r} />}
                  onSelect={choose}
                />
              )}
            </section>

            <section className="ui-panel" aria-labelledby="selected">
              <h2 id="selected">
                {underlyingSymbol(selected)} ↔ {selected.iToken.symbol} <RiskBadge ticker={selected.ticker} />
              </h2>
              {current === undefined || row === undefined ? (
                <p className="screen__note">{t("common.reading")}</p>
              ) : (
                <>
                  <div className="ui-big">
                    <Amount value={row.wrapped} decimals={selected.underlying.decimals} symbol={selected.iToken.symbol} />
                  </div>
                  <p className="screen__note">
                    {rich("common.inWallet", { amount: <Amount value={row.wallet} decimals={selected.underlying.decimals} symbol={underlyingSymbol(selected)} /> })}
                  </p>
                  {/* In the wrap form, WrapControls shows the same notice right above the field. */}
                  {form !== "wrap" && <RiskNotice ticker={selected.ticker} />}
                  <WrapControls
                    key={`${account}-${selected.ticker}`}
                    asset={selected}
                    wrapped={row.wrapped}
                    walletAmount={row.wallet}
                    allowance={row.allowance ?? 0n}
                    wrappingTax={current.wrappingTax}
                    unwrappingTax={current.unwrappingTax}
                    isTreasury={current.isTreasury}
                    tx={tx}
                    blocked={blocked}
                    form={form}
                    otherFormOpen={false}
                    onOpen={setForm}
                    onClose={() => {
                      setForm(null);
                    }}
                  />
                  <p className="screen__note screen__fees">
                    {t("wrapScreen.fees", { wrap: formatBasisPoints(current.wrappingTax), unwrap: current.isTreasury ? t("wrapScreen.noFeeTreasury") : formatBasisPoints(current.unwrappingTax) })}
                  </p>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
