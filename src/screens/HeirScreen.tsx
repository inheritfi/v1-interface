import { useEffect, useState, type ReactNode } from "react";
import { isAddressEqual, type Address } from "viem";
import { Amount } from "../components/Amount";
import { AssetCombobox } from "../components/AssetCombobox";
import { Button } from "../components/Button";
import { Notice } from "../components/Notice";
import { ProcessLine } from "../components/ProcessLine";
import { TxStatus } from "../components/TxStatus";
import { formatBasisPoints, formatUnits, shortAddress } from "../lib/format";
import { addressErrorText, parseAddress, type Hex40 } from "../lib/heirs";
import { compareEntries, groupTitle, labelText, overviewCounts, overviewEntry, summaryText, type OverviewEntry, type OverviewLine } from "../lib/heirOverview";
import { heirStatus, type HeirStatus } from "../lib/heirStatus";
import { heirLine } from "../lib/processLine";
import { REST_ALL_MIN, restLine, restSummary, type RestStatus } from "../lib/restAll";
import { contactLinkHash, ownerLinkHash, SECTION_HASH } from "../lib/section";
import { effectiveNow, formatDateTime, formatPeriod } from "../lib/time";
import type { AssetRole, HeirDetail } from "../web3/heirReads";
import { clockMode } from "../web3/network";
import { useClock } from "../web3/useClock";
import { useHeirOverview, useRoles } from "../web3/useHeir";
import type { HeirSequenceIntent, TxController } from "../web3/useTx";
import { currentLocale, t } from "../i18n";
import { rich } from "../i18n/rich";

interface HeirScreenProps {
  account: Address | undefined;
  /** Owner of the #owner/0x… link (null: no link; "invalid": link with an invalid address). */
  owner: Hex40 | "invalid" | null;
  tx: TxController;
  /** Changes the URL (#owner/0x…, #heir or #contact/0x…). */
  onOwner: (hash: string) => void;
  /** Replaces the URL without creating a history entry (#owner/0x… link of an account that is only a contact). */
  onRedirect: (hash: string) => void;
}

/** Full address, left to right. */
export function FullAddress({ address }: { address: string }) {
  return (
    <bdi className="ui-mono ui-hash" dir="ltr">
      {address}
    </bdi>
  );
}

/**
 * Form to type the owner's address (if the user did not arrive with their link). `linkOf`: which URL it leads to (heir
 * view by default; the contact one uses #contact/0x…).
 */
export function OwnerForm({
  account,
  onOwner,
  linkOf = ownerLinkHash,
  variant = "heir",
}: {
  account: Address | undefined;
  onOwner: (hash: string) => void;
  linkOf?: (owner: Hex40) => string;
  variant?: "heir" | "contact";
}) {
  const [text, setText] = useState("");
  const parsed = parseAddress(text);
  const self = parsed.ok && account !== undefined && isAddressEqual(parsed.address, account);
  const error = text.trim() === "" ? null : !parsed.ok ? addressErrorText(parsed.reason) : self ? t("ownerForm.self") : null;
  return (
    <form
      className="ui-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed.ok && !self) onOwner(linkOf(parsed.address));
      }}
    >
      <label htmlFor="owner-address">{t("ownerForm.label")}</label>
      <input
        id="owner-address"
        className="ui-input ui-input--address ui-mono"
        dir="ltr"
        placeholder="0x…"
        autoComplete="off"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      {error !== null && <p className="ui-form__error">{error}</p>}
      <p className="screen__note">{t("ownerForm.note")}</p>
      <div className="ui-actions">
        <Button type="submit" variant={variant} disabled={!parsed.ok || self}>
          {t("ownerForm.show")}
        </Button>
      </div>
    </form>
  );
}

export function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="ui-row">
      <span className="ui-row__k">{k}</span>
      <span className="ui-row__v">{children}</span>
    </div>
  );
}

interface PanelProps {
  role: AssetRole;
  detail: HeirDetail;
  status: HeirStatus;
  tx: TxController;
  owner: Hex40;
  /** The date from which any heir that claimed can close the claims has already passed ("Claim now" label). */
  claimNow: boolean;
}

/** Panel of the heir in an asset (frame "You're an heir" of visual proposal 1). */
function HeirPanel({ role, detail, status, tx, owner, claimNow }: PanelProps) {
  const [confirm, setConfirm] = useState(false);
  const asset = role.asset;
  const sym = asset.iToken.symbol;
  const d = asset.underlying.decimals;
  const fee = formatBasisPoints(detail.params.inheritanceTax);
  const share = formatBasisPoints(role.heirBps ?? 0n);
  const date = (x: bigint) => formatDateTime(x, currentLocale());
  const blocked = !tx.chainOk ? t("blocked.network") : tx.busy ? t("blocked.busy") : null;
  const act = (kind: "startInheritance" | "executeInheritance" | "executeInheritanceRemaining", label: string) => {
    void tx.run(t("heir.txLabel", { label, symbol: sym }), { kind, asset, owner });
  };
  const deadline = (restFrom: bigint) => <p className="screen__note">{t("heir.deadline", { date: date(restFrom) })}</p>;
  const combined = (
    <Notice tone="notice" title={t("heir.combinedTitle")}>
      {t("heir.combined")}
    </Notice>
  );

  switch (status.kind) {
    case "waiting":
      return (
        <section className="ui-panel ui-panel--heir" aria-labelledby="heir-title">
          <h2 id="heir-title">{t("heir.waitingTitle")}</h2>
          <Row k={t("heir.yourShare")}>{share}</Row>
          <Row k={t("heir.ownerLastActive")}>{date(status.lastActivity)}</Row>
          <Row k={t("heir.canStart")}>{date(status.canStartAt)}</Row>
          <p className="screen__note">{t("heir.waitingNote", { symbol: sym })}</p>
        </section>
      );
    case "no-balance":
      return (
        <section className="ui-panel ui-panel--heir" aria-labelledby="heir-title">
          <h2 id="heir-title">{t("heir.noBalanceTitle")}</h2>
          <Row k={t("heir.yourShare")}>{share}</Row>
          <p className="screen__note">{t("heir.noBalance", { symbol: sym })}</p>
        </section>
      );
    case "recovery-active":
      return (
        <section className="ui-panel ui-panel--heir" aria-labelledby="heir-title">
          <h2 id="heir-title">{t("heir.recoveryTitle")}</h2>
          <Row k={t("heir.recoveryStarted")}>{date(status.recoveryStartedAt)}</Row>
          <Row k={t("heir.canStart")}>{date(status.blockedUntil)}</Row>
          <p className="screen__note">{t("heir.recovery", { symbol: sym })}</p>
        </section>
      );
    case "can-start":
      return (
        <section className="ui-panel ui-panel--heir" aria-labelledby="heir-title">
          <h2 id="heir-title">{t("heir.canStartTitle")}</h2>
          <Row k={t("heir.yourShare")}>{share}</Row>
          <Row k={t("heir.ownerLastActive")}>{date(status.lastActivity)}</Row>
          <p className="screen__note">{t("heir.canStartNote", { period: formatPeriod(detail.params.inheritWaitingTime) })}</p>
          <Button
            variant="heir"
            className="ui-button--block"
            disabled={blocked !== null}
            title={blocked ?? undefined}
            onClick={() => {
              act("startInheritance", t("heir.start"));
            }}
          >
            {t("heir.start")}
          </Button>
        </section>
      );
    case "started":
      return (
        <>
          <section className="ui-panel ui-panel--heir" aria-labelledby="heir-title">
            <h2 id="heir-title">{t("heir.startedTitle", { date: date(status.startedAt) })}</h2>
            <Row k={t("heir.yourShare")}>{share}</Row>
            <Row k={t("heir.atTodaysBalance")}>
              <Amount value={status.estimate} decimals={d} symbol={sym} />
            </Row>
            <Row k={t("heir.claimsOpen")}>{date(status.claimsFrom)}</Row>
            {deadline(status.restFrom)}
          </section>
          {combined}
        </>
      );
    case "can-claim":
      return (
        <>
          <section className="ui-panel ui-panel--heir" aria-labelledby="heir-title">
            <h2 id="heir-title">{t("heir.startedTitle", { date: date(status.startedAt) })}</h2>
            <Row k={t("heir.yourShare")}>{share}</Row>
            <Row k={t("heir.ifClaimNow")}>
              <Amount value={status.potential} decimals={d} symbol={sym} />
            </Row>
            <p className="screen__note">{t("heir.afterFee", { fee })}</p>
            {status.potential === 0n && (
              // Design (executeInheritance): a claim of 0 marks the heir as claimed and gives it the right to the remaining funds.
              <Notice tone="info" title={t("heir.zeroTitle")}>
                {t("heir.zero")}
              </Notice>
            )}
            {claimNow ? (
              <Notice tone="notice" title={t("heir.claimNowTitle")}>
                {t("heir.claimNow")}
              </Notice>
            ) : (
              deadline(status.restFrom)
            )}
            <Button
              variant="heir"
              className="ui-button--block"
              disabled={blocked !== null}
              title={blocked ?? undefined}
              onClick={() => {
                act("executeInheritance", t("heir.claim"));
              }}
            >
              {t("heir.claim")}
            </Button>
          </section>
          {combined}
        </>
      );
    case "claimed":
      return (
        <section className="ui-panel ui-panel--heir" aria-labelledby="heir-title">
          <h2 id="heir-title">{t("heir.claimedTitle")}</h2>
          <Row k={t("heir.claimedBeforeFee")}>
            <Amount value={status.released} decimals={d} symbol={sym} />
          </Row>
          <Row k={t("heir.restFrom")}>{date(status.restFrom)}</Row>
          <p className="screen__note">{t("heir.restNote")}</p>
        </section>
      );
    case "can-claim-rest": {
      const total = status.claimedCount + status.unclaimedCount;
      const amt = (v: bigint) => formatUnits(v, d, Math.min(6, d));
      const you = `${amt(status.potentialRemaining)} ${sym}`;
      return (
        <section className="ui-panel ui-panel--heir" aria-labelledby="heir-title">
          <h2 id="heir-title">{t("heir.restTitle")}</h2>
          <Row k={t("heir.remaining")}>
            <Amount value={status.remaining} decimals={d} symbol={sym} />
          </Row>
          <Row k={t("heir.yourPart")}>
            <Amount value={status.potentialRemaining} decimals={d} symbol={sym} />
          </Row>
          {status.claimsClosed ? (
            // The claims are already closed: these are new remaining funds (A-03) and claiming them closes nothing; no confirmation is needed.
            <>
              <Notice tone="info" title={t("heir.receivePartTitle")}>
                {t("heir.receive", { amount: you, fee })}
              </Notice>
              <Button
                variant="heir"
                className="ui-button--block"
                disabled={blocked !== null}
                title={blocked ?? undefined}
                onClick={() => {
                  act("executeInheritanceRemaining", t("heir.claimRest"));
                }}
              >
                {t("heir.claimRest")}
              </Button>
            </>
          ) : !confirm ? (
            <Button
              variant="heir"
              className="ui-button--block"
              disabled={blocked !== null}
              title={blocked ?? undefined}
              onClick={() => {
                setConfirm(true);
              }}
            >
              {t("heir.claimRest")}
            </Button>
          ) : (
            <>
              {status.unclaimedCount > 0 ? (
                <Notice tone="notice" title={t("heir.closeTitle")}>
                  {t("heir.close", {
                    unclaimed: t("heir.closeUnclaimed", { count: status.unclaimedCount, total }),
                    remaining: amt(status.remaining),
                    symbol: sym,
                    split: t("heir.closeSplit", { count: status.claimedCount }),
                    amount: you,
                    fee,
                  })}
                </Notice>
              ) : (
                <Notice tone="info" title={t("heir.receivePartTitle")}>
                  {t("heir.receive", { amount: you, fee })}
                </Notice>
              )}
              <div className="ui-actions">
                <Button
                  variant="heir"
                  disabled={blocked !== null}
                  title={blocked ?? undefined}
                  onClick={() => {
                    setConfirm(false);
                    act("executeInheritanceRemaining", t("heir.claimRest"));
                  }}
                >
                  {t("heir.closeAndClaim")}
                </Button>
                <Button
                  onClick={() => {
                    setConfirm(false);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </>
          )}
        </section>
      );
    }
    case "done":
      return (
        <section className="ui-panel ui-panel--heir" aria-labelledby="heir-title">
          <h2 id="heir-title">{t("heir.doneTitle")}</h2>
          <Row k={t("heir.claimedBeforeFees")}>
            <Amount value={status.released} decimals={d} symbol={sym} />
          </Row>
          <p className="screen__note">{t("heir.doneWallet", { symbol: sym })}</p>
          <p className="screen__note">{t("heir.doneAgain", { symbol: sym })}</p>
        </section>
      );
    case "missed":
      return (
        <Notice tone="info" title={t("heir.missedTitle")}>
          {t("heir.missed")}
        </Notice>
      );
  }
}

/** Text of the detail line of the overview. */
function lineText(line: OverviewLine, sym: string, decimals: number): string {
  const date = (x: bigint) => formatDateTime(x, currentLocale());
  const amt = (v: bigint) => `${formatUnits(v, decimals, Math.min(6, decimals))} ${sym}`;
  switch (line.kind) {
    case "claim-now":
      return t("heirLine.claimNow");
    case "claim-before":
      return t("heirLine.claimBefore", { date: date(line.date) });
    case "no-activity-since":
      return t("heirLine.noActivitySince", { date: date(line.date) });
    case "rest-left":
      return t("heirLine.restLeft", { amount: amt(line.amount) });
    case "rest-shared":
      return t("heirLine.restShared", { amount: amt(line.amount) });
    case "claims-open":
      return t("heirLine.claimsOpen", { date: date(line.date) });
    case "rest-from":
      return t("heirLine.restFrom", { date: date(line.date) });
    case "can-start":
      return t("heirLine.canStart", { date: date(line.date) });
    case "recovery":
      return t("heirLine.recovery", { date: date(line.date) });
    case "received":
      return t("heirLine.received", { amount: amt(line.amount) });
    case "missed":
      return t("heirLine.missed");
    case "no-balance":
      return t("heirLine.noBalance", { symbol: sym });
    case "error":
      return t("common.cantInterpretShort");
  }
}

function StatusBadge({ entry }: { entry: OverviewEntry }) {
  const tone = entry.label === "Claim now" ? "urgent" : entry.group;
  return <span className={`ui-badge ui-badge--heir-${tone}`}>{labelText(entry.label)}</span>;
}

interface HeirRow {
  role: AssetRole;
  index: number;
  detail: HeirDetail | undefined;
  status: HeirStatus | Error | undefined;
  entry: OverviewEntry | undefined;
}

interface RestRow {
  row: HeirRow;
  detail: HeirDetail;
  status: RestStatus;
}

/**
 * Joint summary of "Claim the rest in all" (design approved on 2026-10-27): one line per asset with its figures,
 * taken from the last read (it updates if they change). With open claims and heirs that have not claimed, a closing notice;
 * if not, only what it receives in each asset.
 */
function RestAllSummary({ items, blocked, onConfirm, onCancel }: { items: readonly RestRow[]; blocked: string | null; onConfirm: () => void; onCancel: () => void }) {
  const { mode, closing } = restSummary(items.map((x) => x.status));
  const lines = items.map(({ row, detail, status }) => {
    const sym = row.role.asset.iToken.symbol;
    const d = row.role.asset.underlying.decimals;
    const amt = (v: bigint) => formatUnits(v, d, Math.min(6, d));
    const amount = `${amt(status.potentialRemaining)} ${sym}`;
    const fee = formatBasisPoints(detail.params.inheritanceTax);
    const kind = restLine(mode, status);
    const text =
      kind === "close"
        ? t("bulk.restLineClose", {
            symbol: sym,
            unclaimed: t("heir.closeUnclaimed", { count: status.unclaimedCount, total: status.claimedCount + status.unclaimedCount }),
            remaining: amt(status.remaining),
            split: t("heir.closeSplit", { count: status.claimedCount }),
            amount,
            fee,
          })
        : kind === "closed"
          ? t("bulk.restLineClosed", { symbol: sym, amount, fee })
          : t("bulk.restLineReceive", { symbol: sym, amount, fee });
    return <li key={row.role.asset.ticker}>{text}</li>;
  });
  return (
    <Notice tone={mode === "close" ? "notice" : "info"} title={mode === "close" ? t("bulk.restCloseTitle", { count: closing }) : t("bulk.restReceiveTitle", { count: items.length })}>
      <ul className="ui-restall">{lines}</ul>
      {mode === "close" && <p className="ui-restall__note">{t("bulk.restCloseNote")}</p>}
      <p className="ui-restall__note">{t("bulk.note")}</p>
      <div className="ui-actions">
        <Button variant="heir" disabled={blocked !== null} title={blocked ?? undefined} onClick={onConfirm}>
          {mode === "close" ? t("bulk.restCloseButton", { count: items.length }) : t("bulk.claimRestAllButton", { count: items.length })}
        </Button>
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </Notice>
  );
}

/** "I'm an heir" screen: with the owner's address (#owner/0x… link or typed), their assets where this account is an heir. */
export function HeirScreen({ account, owner, tx, onOwner, onRedirect }: HeirScreenProps) {
  const clock = useClock(clockMode);
  const valid = owner !== null && owner !== "invalid" ? owner : undefined;
  const isSelf = valid !== undefined && account !== undefined && isAddressEqual(valid, account);
  const roles = useRoles(isSelf ? undefined : valid, account);
  const r = roles.data !== undefined && valid !== undefined && account !== undefined && isAddressEqual(roles.data.owner, valid) && isAddressEqual(roles.data.me, account) ? roles.data : undefined;
  const heirRoles = r?.roles.filter((x) => x.heirBps !== null) ?? [];
  const contactRoles = r?.roles.filter((x) => x.isContact) ?? [];
  const overview = useHeirOverview(r === undefined ? undefined : heirRoles.map((x) => ({ asset: x.asset, heirs: x.heirs })), valid, account);
  // The #owner/0x… link opens the view of the account's role; if it is only a contact, the contact's.
  const onlyContact = r !== undefined && valid !== undefined && heirRoles.length === 0 && contactRoles.length > 0;
  useEffect(() => {
    if (onlyContact) onRedirect(contactLinkHash(valid));
  }, [onlyContact, valid, onRedirect]);
  // The view is only used if it belongs to the current owner, account and list of assets (not a previous read that was kept).
  const od = overview.isPlaceholderData ? undefined : overview.data;
  const o =
    od !== undefined &&
    valid !== undefined &&
    account !== undefined &&
    isAddressEqual(od.owner, valid) &&
    isAddressEqual(od.me, account) &&
    od.details.length === heirRoles.length &&
    od.details.every((d, i) => d.ticker === heirRoles[i]?.asset.ticker)
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
  const rows: HeirRow[] = heirRoles.map((role, index) => {
    const detail = o?.details[index];
    let status: HeirStatus | Error | undefined;
    if (detail !== undefined && now !== undefined && account !== undefined) {
      try {
        status = heirStatus(detail.reads, detail.params, detail.heirs, account, now);
      } catch (e) {
        status = e instanceof Error ? e : new Error("unknown");
      }
    }
    return { role, index, detail, status, entry: status !== undefined && now !== undefined ? overviewEntry(status, now) : undefined };
  });
  const loaded = rows.length > 0 && rows.every((x) => x.entry !== undefined);
  const sorted = loaded
    ? [...rows].sort((a, b) => (a.entry !== undefined && b.entry !== undefined ? compareEntries({ entry: a.entry, index: a.index }, { entry: b.entry, index: b.index }) : 0))
    : rows;

  // Open asset: the one the user chose or, the first time everything is read, the most urgent one (fixed afterwards, so that
  // the panel does not jump to another asset when a state changes). It is forgotten when the owner or the account changes.
  const ctx = `${valid ?? ""}|${account ?? ""}`;
  const [pick, setPick] = useState<{ ctx: string; ticker: string } | undefined>(undefined);
  const chosen = pick?.ctx === ctx ? pick.ticker : undefined;
  const first = sorted[0];
  if (chosen === undefined && loaded && first !== undefined) setPick({ ctx, ticker: first.role.asset.ticker });
  const row = sorted.find((x) => x.role.asset.ticker === chosen) ?? first;

  const blocked = !tx.chainOk ? t("blocked.network") : tx.busy ? t("blocked.busy") : null;
  const startable = loaded && valid !== undefined ? sorted.filter((x) => x.status !== undefined && !(x.status instanceof Error) && x.status.kind === "can-start") : [];
  const claimable =
    loaded && valid !== undefined
      ? sorted.filter((x) => x.status !== undefined && !(x.status instanceof Error) && x.status.kind === "can-claim")
      : [];
  const restable: RestRow[] =
    loaded && valid !== undefined
      ? sorted.flatMap((x) => (x.detail !== undefined && x.status !== undefined && !(x.status instanceof Error) && x.status.kind === "can-claim-rest" ? [{ row: x, detail: x.detail, status: x.status }] : []))
      : [];
  // Summary of "Claim the rest in all" open (it is forgotten when the owner or the account changes).
  const [restOpen, setRestOpen] = useState<string | undefined>(undefined);
  const restShown = restOpen === ctx && restable.length >= REST_ALL_MIN;
  const sequence = (label: string, list: HeirRow[], kind: HeirSequenceIntent["kind"]) => {
    if (valid === undefined) return;
    void tx.runSequence(
      label,
      list.map((x) => ({ kind, asset: x.role.asset, owner: valid })),
    );
  };
  const headOf = (x: HeirRow) => (
    <span className="ui-heirrow__head">
      <span className="ui-mono">
        {x.role.asset.iToken.symbol} · {formatBasisPoints(x.role.heirBps ?? 0n)}
      </span>
      {x.entry !== undefined && <StatusBadge entry={x.entry} />}
    </span>
  );

  return (
    <div className="screen">
      <header>
        <h1 className="screen__title">{t("heirScreen.title")}</h1>
        <p className="screen__sub">{t("heirScreen.sub")}</p>
      </header>

      {owner === null ? (
        <section className="ui-panel ui-panel--narrow">
          <OwnerForm account={account} onOwner={onOwner} />
        </section>
      ) : owner === "invalid" ? (
        <>
          <Notice tone="error" title={t("link.invalidTitle")}>
            {t("link.invalid")}
          </Notice>
          <section className="ui-panel ui-panel--narrow">
            <OwnerForm account={account} onOwner={onOwner} />
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
                onOwner(SECTION_HASH.heir);
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
          ) : heirRoles.length === 0 && contactRoles.length === 0 ? (
            <Notice tone="info" title={t("owner.noRoleTitle", { owner: shortAddress(owner) })}>
              {t("owner.noRole")}
            </Notice>
          ) : (
            <>
              {row !== undefined && heirRoles.length > 1 && (
                <div className="screen__overview">
                  {loaded && (
                    <p className="ui-heir-summary" role="status">
                      {summaryText(overviewCounts(sorted.flatMap((x) => (x.entry !== undefined ? [x.entry] : []))))}
                    </p>
                  )}
                  <div className="screen__toolbar">
                    <div className="screen__picker screen__picker--heir">
                      <span aria-hidden="true">{t("picker.asset")}</span>
                      <AssetCombobox
                        label={t("picker.asset")}
                        searchLabel={t("picker.search")}
                        items={sorted}
                        assetOf={(x) => x.role.asset}
                        selected={row.role.asset.ticker}
                        groupOf={(x) => (x.entry !== undefined ? groupTitle(x.entry.group) : t("overview.reading"))}
                        renderSelected={() => headOf(row)}
                        renderItem={(x) => (
                          <span className="ui-heirrow">
                            {headOf(x)}
                            {x.entry !== undefined && (
                              <span className="ui-heirrow__line">{lineText(x.entry.line, x.role.asset.iToken.symbol, x.role.asset.underlying.decimals)}</span>
                            )}
                          </span>
                        )}
                        onSelect={(ticker) => {
                          setPick({ ctx, ticker });
                        }}
                      />
                    </div>
                    {startable.length > 1 && (
                      <Button
                        variant="heir"
                        disabled={blocked !== null}
                        title={blocked ?? undefined}
                        onClick={() => {
                          sequence(t("bulk.startAll"), startable, "startInheritance");
                        }}
                      >
                        {t("bulk.startAllButton", { count: startable.length })}
                      </Button>
                    )}
                    {claimable.length > 1 && (
                      <Button
                        variant="heir"
                        disabled={blocked !== null}
                        title={blocked ?? undefined}
                        onClick={() => {
                          sequence(t("bulk.claimAll"), claimable, "executeInheritance");
                        }}
                      >
                        {t("bulk.claimAllButton", { count: claimable.length })}
                      </Button>
                    )}
                    {restable.length >= REST_ALL_MIN && (
                      <Button
                        variant="heir"
                        disabled={blocked !== null || restShown}
                        title={blocked ?? undefined}
                        onClick={() => {
                          setRestOpen(ctx);
                        }}
                      >
                        {t("bulk.claimRestAllButton", { count: restable.length })}
                      </Button>
                    )}
                  </div>
                  {(startable.length > 1 || claimable.length > 1 || restable.length >= REST_ALL_MIN) && !restShown && (
                    <p className="screen__note screen__note--tight">{t("bulk.note")}</p>
                  )}
                  {restShown && (
                    <RestAllSummary
                      items={restable}
                      blocked={blocked}
                      onConfirm={() => {
                        setRestOpen(undefined);
                        sequence(
                          t("bulk.claimRestAll"),
                          restable.map((x) => x.row),
                          "executeInheritanceRemaining",
                        );
                      }}
                      onCancel={() => {
                        setRestOpen(undefined);
                      }}
                    />
                  )}
                </div>
              )}
              <TxStatus phase={tx.phase} onDismiss={tx.dismiss} />
              {contactRoles.length > 0 && (
                <Notice tone="info" title={t("heirScreen.alsoContact", { symbols: contactRoles.map((x) => x.asset.iToken.symbol).join(t("list.separator")) })}>
                  <Button
                    variant="contact"
                    onClick={() => {
                      onOwner(contactLinkHash(owner));
                    }}
                  >
                    {t("heirScreen.openContact")}
                  </Button>
                </Notice>
              )}
              {row !== undefined && (
                <div className="screen__section">
                  <p className="screen__sub">
                    {rich("heirScreen.from", { symbol: row.role.asset.iToken.symbol, owner: <bdi className="ui-mono" dir="ltr">{shortAddress(owner)}</bdi> })}
                  </p>
                  <div className="screen__grid">
                    <div className="screen__stack">
                      {overview.isError ? (
                        <Notice tone="error" title={t("heirScreen.readErrorTitle")}>
                          {t("common.retrying")}
                        </Notice>
                      ) : nowError !== undefined || row.status instanceof Error ? (
                        <Notice tone="error" title={t("heirScreen.unsafeTitle")}>
                          {t("common.cantInterpret", { detail: nowError ?? (row.status instanceof Error ? row.status.message : "unknown") })}
                        </Notice>
                      ) : row.status === undefined || row.detail === undefined ? (
                        <Notice tone="info" title={t("heirScreen.readingTitle")}>
                          {t("common.reading")}
                        </Notice>
                      ) : (
                        <HeirPanel key={`${account}-${owner}-${row.role.asset.ticker}`} role={row.role} detail={row.detail} status={row.status} tx={tx} owner={owner} claimNow={row.entry?.label === "Claim now"} />
                      )}
                    </div>
                    {row.detail !== undefined && row.status !== undefined && !(row.status instanceof Error) && now !== undefined && (
                      <section className="ui-panel" aria-labelledby="heir-timeline">
                        <h2 id="heir-timeline">{t("heirScreen.timeline")}</h2>
                        <ProcessLine line={heirLine({ ...row.detail.reads, ...row.detail.params }, now)} locale={currentLocale()} tone="heir" />
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
