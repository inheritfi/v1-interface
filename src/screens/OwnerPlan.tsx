import { useState } from "react";
import { Address } from "../components/Address";
import { Amount } from "../components/Amount";
import { Button } from "../components/Button";
import { Notice } from "../components/Notice";
import { ContactsEditor, HeirsEditor } from "../components/PlanEditors";
import { SuccessionLine } from "../components/SuccessionLine";
import { WrapControls } from "../components/WrapControls";
import type { DeployedAsset } from "../contracts/types";
import { overlap, type Hex40 } from "../lib/heirs";
import { formatBasisPoints } from "../lib/format";
import { planStatus, type PlanReads, type PlanStatus, type ProtocolParams } from "../lib/plan";
import { formatDateTime, formatPeriod } from "../lib/time";
import { protocolAddresses } from "../web3/protocolAddresses";
import type { TxController } from "../web3/useTx";
import { t } from "../i18n";
import { rich } from "../i18n/rich";

interface OwnerPlanProps {
  /** Connected account (owner): it cannot be its own heir or contact. */
  account: Hex40;
  asset: DeployedAsset;
  plan: PlanReads;
  params: ProtocolParams;
  now: bigint;
  /** ETH in the account's wallet (to wrap ETH), read in the same call as the plan. */
  walletEth: bigint;
  /** Only for ERC-20 assets: balance of the underlying in the wallet and current approval to the wrapper (same read). */
  underlying: { wallet: bigint; allowance: bigint } | null;
  /** The account is a treasury wallet of this asset: it pays no fee when unwrapping (InheritfiV1<T>.unwrap). */
  isTreasury: boolean;
  tx: TxController;
  locale: string;
}

type Form = "none" | "wrap" | "unwrap" | "heirs" | "contacts";

/** Owner screen with the real data of the contract: periods, processes in progress, balance, heirs and contacts. */
export function OwnerPlan({ account, asset, plan, params, now, walletEth, underlying, isTreasury, tx, locale }: OwnerPlanProps) {
  const [form, setForm] = useState<Form>("none");
  // The review step of the contacts editor is being shown (it carries its own warnings; see the contacts panel).
  const [contactsReviewing, setContactsReviewing] = useState(false);
  let status: PlanStatus;
  try {
    status = planStatus(plan, params, now);
  } catch (e) {
    return (
      <Notice tone="error" title={t("plan.unsafeTitle")}>
        {t("common.cantInterpret", { detail: e instanceof Error ? e.message : "unknown" })}
      </Notice>
    );
  }
  const sym = asset.iToken.symbol;
  const decimals = asset.underlying.decimals;
  const recovery = formatPeriod(params.recoveryInactivityPeriod);
  const inheritance = formatPeriod(params.inheritInactivityPeriod);
  const isEth = asset.underlying.kind === "native";
  const underlyingSym = asset.underlying.kind === "native" ? "ETH" : asset.underlying.symbol;
  // checkActivity, setHeirs and setRecoveryUsers require previous activity or balance (onlyTestator, InheritfiV1Base.sol).
  const isTestator = plan.activityTimestamp > 0n || plan.balance > 0n;
  const blocked = !tx.chainOk ? t("blocked.network") : tx.busy ? t("blocked.busy") : null;
  // What there is in the wallet to wrap: ETH or the underlying token (read in the same call as the plan).
  const walletAmount = isEth ? walletEth : (underlying?.wallet ?? 0n);
  const allowance = underlying?.allowance ?? 0n;
  // setHeirs and setRecoveryUsers: only an owner (onlyTestator) and without inheritance or recovery in progress ("Process active").
  const editBlocked = !isTestator
    ? t("plan.editNeedsWrap", { underlying: underlyingSym, symbol: sym })
    : plan.inheritanceStarted || plan.recoveryStarted
      ? t("plan.editProcessActive")
      : blocked;
  const listCtx = { account, protocol: protocolAddresses };
  const both = overlap(
    plan.heirs.map((h) => h.wallet),
    plan.recoveryUsers,
  );
  const contactPower = t("plan.contactPower", { recovery, waiting: formatPeriod(params.recoveryWaitingTime), symbol: sym, fee: formatBasisPoints(params.recoveryTax) });

  return (
    <>
      {status.kind === "recovery-started" && (
        <Notice tone="error" title={t("plan.recoveryTitle")}>
          {t("plan.recovery", { startedAt: formatDateTime(status.startedAt, locale), executableAt: formatDateTime(status.executableAt, locale), symbol: sym, fee: formatBasisPoints(params.recoveryTax) })}
        </Notice>
      )}
      {status.kind === "inheritance-started" && (
        <Notice tone="notice" title={t("plan.inheritanceTitle")}>
          {t("plan.inheritance", { startedAt: formatDateTime(status.startedAt, locale), claimsFrom: formatDateTime(status.claimsFrom, locale), remainingFrom: formatDateTime(status.remainingFrom, locale) })}
        </Notice>
      )}
      {status.kind === "inheritance-closed" && (
        <Notice tone="info" title={t("plan.completedTitle")}>
          {t("plan.completed", { symbol: sym })}
        </Notice>
      )}

      <div className="screen__grid">
        <section className="ui-panel" aria-labelledby="inactivity">
          <h2 id="inactivity">{t("plan.inactivity")}</h2>
          {status.kind === "idle" ? (
            <>
              <div className="ui-big">
                {status.succession.inactiveDays.toString()}
                <small>{t("plan.ofPeriod", { period: inheritance })}</small>
              </div>
              <SuccessionLine
                lastActivity={plan.activityTimestamp}
                recoveryPeriod={params.recoveryInactivityPeriod}
                inheritancePeriod={params.inheritInactivityPeriod}
                now={now}
                locale={locale}
              />
            </>
          ) : status.kind === "no-plan" ? (
            <p className="screen__note">{t("plan.noPlan", { symbol: sym })}</p>
          ) : (
            <p className="screen__note">{t("plan.seeNotice")}</p>
          )}
          <div className="ui-actions">
            <Button
              variant="primary"
              disabled={!isTestator || blocked !== null}
              title={!isTestator ? t("plan.confirmNeedsWrap", { underlying: underlyingSym }) : (blocked ?? undefined)}
              onClick={() => {
                void tx.run(t("plan.confirmLabel", { symbol: sym }), { kind: "checkActivity", asset });
              }}
            >
              {t("plan.confirm")}
            </Button>
          </div>
          <p className="screen__note">{t("plan.periods", { recovery, inheritance })}</p>
        </section>

        <div className="screen__stack">
          <section className="ui-panel" aria-labelledby="balance">
            <h2 id="balance">{t("plan.balance")}</h2>
            <div className="ui-big">
              <Amount value={plan.balance} decimals={asset.underlying.decimals} symbol={sym} />
            </div>
            <p className="screen__note">{rich("common.inWallet", { amount: <Amount value={walletAmount} decimals={decimals} symbol={underlyingSym} /> })}</p>
            <WrapControls
              asset={asset}
              wrapped={plan.balance}
              walletAmount={walletAmount}
              allowance={allowance}
              wrappingTax={params.wrappingTax}
              unwrappingTax={params.unwrappingTax}
              isTreasury={isTreasury}
              tx={tx}
              blocked={blocked}
              form={form === "wrap" || form === "unwrap" ? form : null}
              otherFormOpen={form !== "none" && form !== "wrap" && form !== "unwrap"}
              onOpen={setForm}
              onClose={() => {
                setForm("none");
              }}
            />
          </section>

          <section className="ui-panel" aria-labelledby="heirs">
            <h2 id="heirs">{t("plan.heirs")}</h2>
            {plan.heirs.length === 0 && <p className="screen__note">{t("plan.noHeirs")}</p>}
            {plan.heirs.map((heir) => (
              <div className="ui-share" key={heir.wallet}>
                <Address address={heir.wallet} />
                <span className="ui-share__bar">
                  <i style={{ width: formatBasisPoints(heir.bps) }} />
                </span>
                <span className="ui-mono ui-share__pct">{formatBasisPoints(heir.bps)}</span>
              </div>
            ))}
            {form === "heirs" ? (
              <HeirsEditor
                ctx={listCtx}
                current={plan.heirs}
                maxHeirs={params.maxHeirs}
                contacts={plan.recoveryUsers}
                disabled={editBlocked !== null}
                onCancel={() => {
                  setForm("none");
                }}
                onSubmit={(value) => {
                  setForm("none");
                  void tx.run(t("plan.saveHeirsLabel", { symbol: sym }), { kind: "setHeirs", asset, wallets: value.wallets, bps: value.bps });
                }}
              />
            ) : (
              <div className="ui-actions">
                <Button
                  disabled={editBlocked !== null || form !== "none"}
                  title={editBlocked ?? undefined}
                  onClick={() => {
                    setForm("heirs");
                  }}
                >
                  {t("plan.editHeirs")}
                </Button>
              </div>
            )}
          </section>

          <section className="ui-panel" aria-labelledby="recovery">
            <h2 id="recovery">{t("plan.contacts")}</h2>
            {plan.recoveryUsers.length === 0 && <p className="screen__note">{t("plan.noContacts")}</p>}
            {plan.recoveryUsers.map((contact) => (
              <div className="ui-share" key={contact}>
                <Address address={contact} />
                <span className="screen__muted">{t("plan.canActAfter", { period: recovery })}</span>
              </div>
            ))}
            {/* In the review step the editor shows the same two things as warnings (power of the contacts; address that is
                also an heir, about the list being signed): these notes are hidden there so nothing is said twice. */}
            {!contactsReviewing && (
              <p className="screen__note">
                {t("plan.contactsNote", { symbol: sym, fee: formatBasisPoints(params.recoveryTax), recovery, waiting: formatPeriod(params.recoveryWaitingTime) })}
              </p>
            )}
            {plan.recoveryUsers.length > 0 && (
              <p className="screen__note">{t("plan.contactsFirst")}</p>
            )}
            {both.length > 0 && !contactsReviewing && (
              <p className="screen__note">{t("plan.both", { count: both.length })}</p>
            )}
            {form === "contacts" ? (
              <ContactsEditor
                ctx={listCtx}
                current={plan.recoveryUsers}
                maxRecoveryUsers={params.maxRecoveryUsers}
                heirs={plan.heirs.map((h) => h.wallet)}
                power={contactPower}
                disabled={editBlocked !== null}
                onReviewing={setContactsReviewing}
                onCancel={() => {
                  setForm("none");
                }}
                onSubmit={(wallets) => {
                  setForm("none");
                  void tx.run(t("plan.saveContactsLabel", { symbol: sym }), { kind: "setRecoveryUsers", asset, wallets });
                }}
              />
            ) : (
              <div className="ui-actions">
                <Button
                  disabled={editBlocked !== null || form !== "none"}
                  title={editBlocked ?? undefined}
                  onClick={() => {
                    setForm("contacts");
                  }}
                >
                  {t("plan.editContacts")}
                </Button>
              </div>
            )}
          </section>

          <section className="ui-panel" aria-labelledby="fees">
            <h2 id="fees">{t("plan.feesTitle", { symbol: sym })}</h2>
            <p className="screen__note screen__fees">
              {t("plan.fees", { wrap: formatBasisPoints(params.wrappingTax), unwrap: formatBasisPoints(params.unwrappingTax), inheritance: formatBasisPoints(params.inheritanceTax), recovery: formatBasisPoints(params.recoveryTax) })}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
