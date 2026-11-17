import { useState } from "react";
import { isAddressEqual, type Address } from "viem";
import { Amount } from "../components/Amount";
import { AssetCombobox } from "../components/AssetCombobox";
import { Button } from "../components/Button";
import { Notice } from "../components/Notice";
import { ProcessLine } from "../components/ProcessLine";
import { TxStatus } from "../components/TxStatus";
import type { DeployedAsset } from "../contracts/types";
import { compareContactEntries, contactCounts, contactEntry, contactGroupTitle, contactLabelText, contactSummaryText, type ContactEntry, type ContactLine } from "../lib/contactOverview";
import { contactStatus, type ContactStatus } from "../lib/contactStatus";
import { contactLine } from "../lib/processLine";
import { formatBasisPoints, formatUnits, shortAddress } from "../lib/format";
import type { Hex40 } from "../lib/heirs";
import { contactLinkHash, ownerLinkHash, SECTION_HASH } from "../lib/section";
import { effectiveNow, formatDateTime, formatPeriod } from "../lib/time";
import type { ContactDetail } from "../web3/contactReads";
import { clockMode } from "../web3/network";
import { useClock } from "../web3/useClock";
import { useContactOverview } from "../web3/useContact";
import { useRoles } from "../web3/useHeir";
import type { HeirSequenceIntent, TxController } from "../web3/useTx";
import { FullAddress, OwnerForm, Row } from "./HeirScreen";
import { currentLocale, t } from "../i18n";
import { rich } from "../i18n/rich";

interface ContactScreenProps {
  account: Address | undefined;
  /** Owner from the URL #contact/0x… (null: no address; "invalid": invalid address). */
  owner: Hex40 | "invalid" | null;
  tx: TxController;
  /** Changes the URL (#contact/0x…, #contact or #owner/0x…). */
  onOwner: (hash: string) => void;
}

interface PanelProps {
  asset: DeployedAsset;
  detail: ContactDetail;
  status: ContactStatus;
  tx: TxController;
  owner: Hex40;
}

/** Panel of the contact in an asset. */
function ContactPanel({ asset, detail, status, tx, owner }: PanelProps) {
  const sym = asset.iToken.symbol;
  const d = asset.underlying.decimals;
  const fee = formatBasisPoints(detail.params.recoveryTax);
  const date = (x: bigint) => formatDateTime(x, currentLocale());
  const blocked = !tx.chainOk ? t("blocked.network") : tx.busy ? t("blocked.busy") : null;
  const act = (kind: "startRecovery" | "executeRecovery", label: string) => {
    void tx.run(t("heir.txLabel", { label, symbol: sym }), { kind, asset, owner });
  };
  const balance = (
    <Row k={t("contact.ownerBalance")}>
      <Amount value={detail.reads.balance} decimals={d} symbol={sym} />
    </Row>
  );

  switch (status.kind) {
    case "waiting":
      return (
        <section className="ui-panel ui-panel--contact" aria-labelledby="contact-title">
          <h2 id="contact-title">{t("heir.waitingTitle")}</h2>
          <Row k={t("heir.ownerLastActive")}>{date(status.lastActivity)}</Row>
          <Row k={t("contact.canStart")}>{date(status.canStartAt)}</Row>
        </section>
      );
    case "can-start":
    case "nothing":
      return (
        <>
          <section className="ui-panel ui-panel--contact" aria-labelledby="contact-title">
            <h2 id="contact-title">{status.kind === "nothing" ? t("contact.nothingTitle") : t("contact.canStartTitle")}</h2>
            <Row k={t("heir.ownerLastActive")}>{date(status.lastActivity)}</Row>
            {balance}
            {status.kind === "nothing" || status.balance === 0n ? (
              <p className="screen__note">{t("contact.noBalance", { symbol: sym })}</p>
            ) : null}
            <p className="screen__note">{t("contact.startNote", { period: formatPeriod(detail.params.recoveryWaitingTime) })}</p>
            <Button
              variant="contact"
              className="ui-button--block"
              disabled={blocked !== null}
              title={blocked ?? undefined}
              onClick={() => {
                act("startRecovery", t("contact.start"));
              }}
            >
              {t("contact.start")}
            </Button>
          </section>
          {status.kind === "can-start" && status.inheritanceInProgress && (
            <Notice tone="notice" title={t("contact.cancelsInheritanceTitle")}>
              {t("contact.cancelsInheritance")}
            </Notice>
          )}
        </>
      );
    case "started":
      return (
        <section className="ui-panel ui-panel--contact" aria-labelledby="contact-title">
          <h2 id="contact-title">{t("contact.startedTitle", { date: date(status.startedAt) })}</h2>
          {balance}
          <Row k={t("contact.recoverFrom")}>{date(status.recoverFrom)}</Row>
        </section>
      );
    case "started-empty":
      return (
        <section className="ui-panel ui-panel--contact" aria-labelledby="contact-title">
          <h2 id="contact-title">{t("contact.startedTitle", { date: date(status.startedAt) })}</h2>
          {balance}
          <p className="screen__note">{t("contact.nothingYet")}</p>
        </section>
      );
    case "can-recover": {
      const you = `${formatUnits(status.net, d, Math.min(6, d))} ${sym}`;
      return (
        <section className="ui-panel ui-panel--contact" aria-labelledby="contact-title">
          <h2 id="contact-title">{t("contact.startedTitle", { date: date(status.startedAt) })}</h2>
          {balance}
          {status.takeoverNow ? (
            <Notice tone="notice" title={t("contact.takeoverNow")} />
          ) : status.takeoverAt !== null ? (
            <Row k={t("contact.takeoverFrom")}>{date(status.takeoverAt)}</Row>
          ) : (
            <p className="screen__note">{t("contact.noHeirs")}</p>
          )}
          <Notice tone="info" title={t("heir.receive", { amount: you, fee })} />
          {status.contactCount > 1 && (
            <p className="screen__note">{t("contact.manyContacts", { count: status.contactCount, symbol: sym })}</p>
          )}
          <Button
            variant="contact"
            className="ui-button--block"
            disabled={blocked !== null}
            title={blocked ?? undefined}
            onClick={() => {
              act("executeRecovery", t("contact.recover", { symbol: sym }));
            }}
          >
            {t("contact.recover", { symbol: sym })}
          </Button>
        </section>
      );
    }
  }
}

/** Text of the detail line of the overview (texts approved on 2026-10-15). */
function lineText(line: ContactLine, sym: string): string {
  const date = (x: bigint) => formatDateTime(x, currentLocale());
  switch (line.kind) {
    case "takeover-now":
      return t("contact.takeoverNow");
    case "takeover-from":
      return t("contactLine.takeoverFrom", { date: date(line.date) });
    case "no-heirs":
      return t("contact.noHeirs");
    case "no-activity-since":
      return t("contactLine.noActivitySince", { date: date(line.date) });
    case "inheritance-in-progress":
      return t("contactLine.inheritance");
    case "recover-from":
      return t("contactLine.recoverFrom", { date: date(line.date) });
    case "nothing-yet":
      return t("contact.nothingYet");
    case "can-start-from":
      return t("contactLine.canStartFrom", { date: date(line.date) });
    case "no-balance":
      return t("contactLine.noBalance", { symbol: sym });
    case "error":
      return t("common.cantInterpretShort");
  }
}

function StatusBadge({ entry }: { entry: ContactEntry }) {
  const tone = entry.label === "Recover now" ? "urgent" : entry.group;
  return <span className={`ui-badge ui-badge--contact-${tone}`}>{contactLabelText(entry.label)}</span>;
}

interface ContactRow {
  asset: DeployedAsset;
  index: number;
  detail: ContactDetail | undefined;
  status: ContactStatus | Error | undefined;
  entry: ContactEntry | undefined;
}

/** "I'm a recovery contact" screen: with the owner's address, their assets where this account is a recovery contact. */
export function ContactScreen({ account, owner, tx, onOwner }: ContactScreenProps) {
  const clock = useClock(clockMode);
  const valid = owner !== null && owner !== "invalid" ? owner : undefined;
  const isSelf = valid !== undefined && account !== undefined && isAddressEqual(valid, account);
  const roles = useRoles(isSelf ? undefined : valid, account);
  const r = roles.data !== undefined && valid !== undefined && account !== undefined && isAddressEqual(roles.data.owner, valid) && isAddressEqual(roles.data.me, account) ? roles.data : undefined;
  const contactAssets = r?.roles.filter((x) => x.isContact).map((x) => x.asset) ?? [];
  const heirRoles = r?.roles.filter((x) => x.heirBps !== null) ?? [];
  const overview = useContactOverview(r === undefined ? undefined : contactAssets, valid, account);
  // The view is only used if it belongs to the current owner, account and list of assets (not a previous read that was kept).
  const od = overview.isPlaceholderData ? undefined : overview.data;
  const o =
    od !== undefined &&
    valid !== undefined &&
    account !== undefined &&
    isAddressEqual(od.owner, valid) &&
    isAddressEqual(od.me, account) &&
    od.details.length === contactAssets.length &&
    od.details.every((x, i) => x.ticker === contactAssets[i]?.ticker)
      ? od
      : undefined;

  let now: bigint | undefined;
  let nowError: string | undefined;
  if (o !== undefined) {
    try {
      now = effectiveNow(clockMode, o.blockTimestamp, () => {
        if (clock === null) throw new Error("No clock in this mode");
        return clock;
      });
    } catch (e) {
      nowError = e instanceof Error ? e.message : "unknown";
    }
  }
  const rows: ContactRow[] = contactAssets.map((asset, index) => {
    const detail = o?.details[index];
    let status: ContactStatus | Error | undefined;
    if (detail !== undefined && now !== undefined && account !== undefined) {
      try {
        status = contactStatus(detail.reads, detail.params, account, detail.recoveryUserCount, now);
      } catch (e) {
        status = e instanceof Error ? e : new Error("unknown");
      }
    }
    return { asset, index, detail, status, entry: status !== undefined ? contactEntry(status) : undefined };
  });
  const loaded = rows.length > 0 && rows.every((x) => x.entry !== undefined);
  const sorted = loaded
    ? [...rows].sort((a, b) => (a.entry !== undefined && b.entry !== undefined ? compareContactEntries({ entry: a.entry, index: a.index }, { entry: b.entry, index: b.index }) : 0))
    : rows;

  // Open asset: the one the user chose or, the first time everything is read, the most urgent one (fixed afterwards).
  const ctx = `${valid ?? ""}|${account ?? ""}`;
  const [pick, setPick] = useState<{ ctx: string; ticker: string } | undefined>(undefined);
  const chosen = pick?.ctx === ctx ? pick.ticker : undefined;
  const first = sorted[0];
  if (chosen === undefined && loaded && first !== undefined) setPick({ ctx, ticker: first.asset.ticker });
  const row = sorted.find((x) => x.asset.ticker === chosen) ?? first;

  const blocked = !tx.chainOk ? t("blocked.network") : tx.busy ? t("blocked.busy") : null;
  const ofKind = (kind: ContactStatus["kind"]) => (loaded && valid !== undefined ? sorted.filter((x) => x.status !== undefined && !(x.status instanceof Error) && x.status.kind === kind) : []);
  const startable = ofKind("can-start");
  const recoverable = ofKind("can-recover");
  const sequence = (label: string, list: ContactRow[], kind: HeirSequenceIntent["kind"]) => {
    if (valid === undefined) return;
    void tx.runSequence(
      label,
      list.map((x) => ({ kind, asset: x.asset, owner: valid })),
    );
  };
  const headOf = (x: ContactRow) => (
    <span className="ui-heirrow__head">
      <span className="ui-mono">{x.asset.iToken.symbol}</span>
      {x.entry !== undefined && <StatusBadge entry={x.entry} />}
    </span>
  );
  const alsoHeir = valid !== undefined && heirRoles.length > 0 && (
    <Notice tone="info" title={t(contactAssets.length > 0 ? "contactScreen.alsoHeir" : "contactScreen.heir", { symbols: heirRoles.map((x) => x.asset.iToken.symbol).join(t("list.separator")) })}>
      <Button
        variant="heir"
        onClick={() => {
          onOwner(ownerLinkHash(valid));
        }}
      >
        {t("contactScreen.openHeir")}
      </Button>
    </Notice>
  );

  return (
    <div className="screen">
      <header>
        <h1 className="screen__title">{t("contactScreen.title")}</h1>
        <p className="screen__sub">{t("contactScreen.sub")}</p>
      </header>

      {owner === null ? (
        <section className="ui-panel ui-panel--narrow">
          <OwnerForm account={account} onOwner={onOwner} linkOf={contactLinkHash} variant="contact" />
        </section>
      ) : owner === "invalid" ? (
        <>
          <Notice tone="error" title={t("link.invalidTitle")}>
            {t("link.invalid")}
          </Notice>
          <section className="ui-panel ui-panel--narrow">
            <OwnerForm account={account} onOwner={onOwner} linkOf={contactLinkHash} variant="contact" />
          </section>
        </>
      ) : (
        <>
          <div className="ui-owner">
            <span className="screen__muted">{t("owner.label")}</span> <FullAddress address={owner} />{" "}
            <button
              type="button"
              className="ui-link"
              onClick={() => {
                onOwner(SECTION_HASH.contact);
              }}
            >
              {t("owner.change")}
            </button>
          </div>
          {account === undefined ? (
            <Notice tone="info" title={t("common.connectTitle")}>
              {t("owner.connect")}
            </Notice>
          ) : isSelf ? (
            <Notice tone="info" title={t("owner.selfTitle")}>
              {t("owner.self")}
            </Notice>
          ) : roles.isError ? (
            <>
              <Notice tone="error" title={t("owner.readErrorTitle")}>
                {t("common.nothingShown")}
              </Notice>
              <div className="ui-actions">
                <Button
                  onClick={() => {
                    void roles.refetch();
                  }}
                >
                  {t("common.tryAgain")}
                </Button>
              </div>
            </>
          ) : r === undefined ? (
            <Notice tone="info" title={t("owner.readingTitle")}>
              {t("common.reading")}
            </Notice>
          ) : contactAssets.length === 0 ? (
            heirRoles.length === 0 ? (
              <Notice tone="info" title={t("owner.noRoleTitle", { owner: shortAddress(owner) })}>
                {t("owner.noRole")}
              </Notice>
            ) : (
              <>
                <Notice tone="info" title={t("contactScreen.notContact", { owner: shortAddress(owner) })} />
                {alsoHeir}
              </>
            )
          ) : (
            <>
              {row !== undefined && contactAssets.length > 1 && (
                <div className="screen__overview">
                  {loaded && (
                    <p className="ui-heir-summary" role="status">
                      {contactSummaryText(contactCounts(sorted.flatMap((x) => (x.entry !== undefined ? [x.entry] : []))))}
                    </p>
                  )}
                  <div className="screen__toolbar">
                    <div className="screen__picker screen__picker--heir">
                      <span aria-hidden="true">{t("picker.asset")}</span>
                      <AssetCombobox
                        label={t("picker.asset")}
                        searchLabel={t("picker.search")}
                        items={sorted}
                        assetOf={(x) => x.asset}
                        selected={row.asset.ticker}
                        groupOf={(x) => (x.entry !== undefined ? contactGroupTitle(x.entry.group) : t("overview.reading"))}
                        renderSelected={() => headOf(row)}
                        renderItem={(x) => (
                          <span className="ui-heirrow">
                            {headOf(x)}
                            {x.entry !== undefined && <span className="ui-heirrow__line">{lineText(x.entry.line, x.asset.iToken.symbol)}</span>}
                          </span>
                        )}
                        onSelect={(ticker) => {
                          setPick({ ctx, ticker });
                        }}
                      />
                    </div>
                    {startable.length > 1 && (
                      <Button
                        variant="contact"
                        disabled={blocked !== null}
                        title={blocked ?? undefined}
                        onClick={() => {
                          sequence(t("bulk.startAll"), startable, "startRecovery");
                        }}
                      >
                        {t("bulk.startAllButton", { count: startable.length })}
                      </Button>
                    )}
                    {recoverable.length > 1 && (
                      <Button
                        variant="contact"
                        disabled={blocked !== null}
                        title={blocked ?? undefined}
                        onClick={() => {
                          sequence(t("bulk.recoverAll"), recoverable, "executeRecovery");
                        }}
                      >
                        {t("bulk.recoverAllButton", { count: recoverable.length })}
                      </Button>
                    )}
                  </div>
                  {(startable.length > 1 || recoverable.length > 1) && (
                    <p className="screen__note screen__note--tight">{t("bulk.note")}</p>
                  )}
                </div>
              )}
              <TxStatus phase={tx.phase} onDismiss={tx.dismiss} />
              {alsoHeir}
              {row !== undefined && (
                <div className="screen__section">
                  <p className="screen__sub">
                    {rich("contactScreen.of", { symbol: row.asset.iToken.symbol, owner: <bdi className="ui-mono" dir="ltr">{shortAddress(owner)}</bdi> })}
                  </p>
                  <div className="screen__grid">
                    <div className="screen__stack">
                      {overview.isError ? (
                        <Notice tone="error" title={t("contactScreen.readErrorTitle")}>
                          {t("common.retrying")}
                        </Notice>
                      ) : nowError !== undefined || row.status instanceof Error ? (
                        <Notice tone="error" title={t("contactScreen.unsafeTitle")}>
                          {t("common.cantInterpret", { detail: nowError ?? (row.status instanceof Error ? row.status.message : "unknown") })}
                        </Notice>
                      ) : row.status === undefined || row.detail === undefined ? (
                        <Notice tone="info" title={t("contactScreen.readingTitle")}>
                          {t("common.reading")}
                        </Notice>
                      ) : (
                        <ContactPanel key={`${account}-${owner}-${row.asset.ticker}`} asset={row.asset} detail={row.detail} status={row.status} tx={tx} owner={owner} />
                      )}
                    </div>
                    {row.detail !== undefined && row.status !== undefined && !(row.status instanceof Error) && now !== undefined && (
                      <section className="ui-panel" aria-labelledby="contact-timeline">
                        <h2 id="contact-timeline">{t("contactScreen.timeline")}</h2>
                        <ProcessLine
                          line={contactLine({ ...row.detail.reads, ...row.detail.params }, now)}
                          locale={currentLocale()}
                          tone="contact"
                          toneOf={(key) => (key === "takeover" ? "heir" : undefined)}
                        />
                      </section>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
