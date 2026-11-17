import { useState } from "react";
import type { DeployedAsset } from "../contracts/types";
import { planWrapSteps } from "../lib/approval";
import { assetRisk, riskLabel } from "../lib/assetRisk";
import { splitFee } from "../lib/fees";
import { formatBasisPoints, formatExact } from "../lib/format";
import type { TxController } from "../web3/useTx";
import { Address } from "./Address";
import { Amount } from "./Amount";
import { AmountForm, type AmountCheck } from "./AmountForm";
import { Button } from "./Button";
import { Notice } from "./Notice";
import { t, type MessageKey } from "../i18n";
import { rich } from "../i18n/rich";

const STEP_NAMES: Record<"reset" | "approve" | "wrap", MessageKey> = { reset: "wrap.stepReset", approve: "wrap.stepApprove", wrap: "wrap.stepWrap" };

export type WrapForm = "wrap" | "unwrap";

/** Risk label of the asset (Native / Standard / Notice). */
export function RiskBadge({ ticker }: { ticker: string }) {
  const r = assetRisk(ticker);
  return <span className={`ui-badge ui-badge--${r.kind}`}>{riskLabel(r.kind)}</span>;
}

/** Risk notice of the asset (only those that have one): it is shown before wrapping. */
export function RiskNotice({ ticker }: { ticker: string }) {
  const n = assetRisk(ticker).notice;
  if (n === null) return null;
  return (
    <Notice tone="notice" title={n.title}>
      {n.body}
    </Notice>
  );
}

interface WrapControlsProps {
  asset: DeployedAsset;
  /** Wrapped balance (iToken) of the account. */
  wrapped: bigint;
  /** In the wallet: ETH or the underlying token (same read). */
  walletAmount: bigint;
  /** Current approval of the underlying to the wrapper; 0 for ETH. */
  allowance: bigint;
  wrappingTax: bigint;
  unwrappingTax: bigint;
  /** The account is a treasury wallet of this asset: it pays no fee when unwrapping (InheritfiV1<T>.unwrap). */
  isTreasury: boolean;
  tx: TxController;
  /** Reason why it cannot be signed now (network, another transaction) or null. */
  blocked: string | null;
  /** Open form of this block, or null. */
  form: WrapForm | null;
  /** There is another form open on the screen (a second one is not opened). */
  otherFormOpen: boolean;
  onOpen: (form: WrapForm) => void;
  onClose: () => void;
}

/**
 * Wrapping and unwrapping an asset (a single logic for the plan screen and the "Wrap and unwrap" one): approval
 * line with "Cancel approval", buttons, risk notice before wrapping and forms with their exact summary.
 */
export function WrapControls({
  asset,
  wrapped,
  walletAmount,
  allowance,
  wrappingTax,
  unwrappingTax,
  isTreasury,
  tx,
  blocked,
  form,
  otherFormOpen,
  onOpen,
  onClose,
}: WrapControlsProps) {
  const sym = asset.iToken.symbol;
  const decimals = asset.underlying.decimals;
  const isEth = asset.underlying.kind === "native";
  const underlyingSym = asset.underlying.kind === "native" ? "ETH" : asset.underlying.symbol;
  // In the summary, exact amounts (all the necessary decimals), so that nothing looks like 0 without being 0.
  const fmt = (v: bigint) => formatExact(v, decimals);
  // Last ETH "Max": the summary says how much ETH stays for the network only if the amount is still that one.
  const [ethMax, setEthMax] = useState<{ amount: bigint; reserve: bigint } | null>(null);

  const checkWrap = (amount: bigint): AmountCheck => {
    const { fee, net } = splitFee(amount, wrappingTax);
    const summary = t("wrap.summary", { amount: fmt(amount), underlying: underlyingSym, fee: fmt(fee), pct: formatBasisPoints(wrappingTax), net: fmt(net), symbol: sym });
    if (isEth) {
      const text = ethMax !== null && amount === ethMax.amount ? t("wrap.summaryEthMax", { summary, reserve: fmt(ethMax.reserve) }) : t("wrap.summaryEth", { summary });
      return { ok: true, text };
    }
    const steps = planWrapSteps(allowance, amount);
    const list = steps.map((s, i) => t("wrap.stepItem", { n: i + 1, step: t(STEP_NAMES[s]) })).join(t("wrap.stepSeparator"));
    return { ok: true, text: t("wrap.summaryToken", { summary, count: steps.length, list, symbol: sym }) };
  };
  const checkUnwrap = (amount: bigint): AmountCheck => {
    // Treasury wallets pay no fee when unwrapping (InheritfiV1<T>.unwrap, _isTreasuryWallet).
    const { fee, net } = isTreasury ? { fee: 0n, net: amount } : splitFee(amount, unwrappingTax);
    const feeText = isTreasury ? t("unwrap.noFee") : t("unwrap.fee", { fee: fmt(fee), symbol: sym, pct: formatBasisPoints(unwrappingTax) });
    return { ok: true, text: t("unwrap.summary", { amount: fmt(amount), symbol: sym, feeText, net: fmt(net), underlying: underlyingSym }) };
  };

  return (
    <>
      {!isEth && allowance > 0n && (
        <div className="ui-approval">
          <p className="screen__note">
            {rich("wrap.approved", { symbol: sym, address: <Address address={asset.address} />, amount: <Amount value={allowance} decimals={decimals} symbol={underlyingSym} /> })}
          </p>
          <div className="ui-actions">
            <Button
              disabled={blocked !== null}
              title={blocked ?? undefined}
              onClick={() => {
                void tx.run(t("wrap.cancelApprovalLabel", { symbol: underlyingSym }), { kind: "approve", asset, amount: 0n });
              }}
            >
              {t("wrap.cancelApproval")}
            </Button>
          </div>
        </div>
      )}
      {form === null ? (
        <div className="ui-actions">
          <Button
            disabled={blocked !== null || walletAmount === 0n || otherFormOpen}
            title={blocked ?? (walletAmount === 0n ? t("wrap.noWallet", { symbol: underlyingSym }) : undefined)}
            onClick={() => {
              onOpen("wrap");
            }}
          >
            {wrapped > 0n ? t("wrap.more") : t("wrap.wrap")}
          </Button>
          <Button
            disabled={wrapped === 0n || blocked !== null || otherFormOpen}
            title={wrapped === 0n ? t("unwrap.nothing", { symbol: sym }) : (blocked ?? undefined)}
            onClick={() => {
              onOpen("unwrap");
            }}
          >
            {t("unwrap.unwrap")}
          </Button>
        </div>
      ) : form === "wrap" ? (
        <>
          <RiskNotice ticker={asset.ticker} />
          <AmountForm
            label={t("wrap.amountLabel", { symbol: underlyingSym })}
            symbol={underlyingSym}
            decimals={decimals}
            max={walletAmount}
            // On ETH, Max leaves the reserve for the network fee (it is computed when pressed).
            offerMax={true}
            onMax={
              isEth
                ? async () => {
                    const r = await tx.ethMax(asset, walletAmount);
                    setEthMax(r.ok ? { amount: r.amount, reserve: r.reserve } : null);
                    return r;
                  }
                : undefined
            }
            check={checkWrap}
            disabled={blocked !== null}
            submitLabel={t("wrap.wrap")}
            onCancel={onClose}
            onSubmit={(value) => {
              onClose();
              if (isEth) void tx.run(t("wrap.txLabel", { symbol: underlyingSym }), { kind: "wrapEth", asset, value });
              else void tx.wrapToken(t("wrap.txLabel", { symbol: underlyingSym }), asset, value);
            }}
          />
        </>
      ) : (
        <AmountForm
          label={t("unwrap.amountLabel", { symbol: sym })}
          symbol={sym}
          decimals={decimals}
          max={wrapped}
          offerMax={true}
          check={checkUnwrap}
          disabled={blocked !== null}
          submitLabel={t("unwrap.unwrap")}
          onCancel={onClose}
          onSubmit={(amount) => {
            onClose();
            void tx.run(t("unwrap.txLabel", { symbol: sym }), { kind: "unwrap", asset, amount });
          }}
        />
      )}
    </>
  );
}
