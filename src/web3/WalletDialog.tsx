import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useConnect, type Connector } from "wagmi";
import { Icon } from "../components/Icon";
import { t } from "../i18n";
import { rich } from "../i18n/rich";
import { chain } from "./network";
import { displayUrl, type FixedRow, type OtherRow, type SupportedWallet } from "./wallets";

/**
 * The connect dialog: the same glass panel as the app menu, centred on wide screens
 * and rising from the bottom on phones. Each wallet row is one button (logo and name). An installed wallet connects; a
 * fixed wallet that is not installed opens the install step in the same box. It closes with Escape (also from the
 * install step), a click or tap outside, the close button and, on phones, a swipe down; focus then returns to
 * "Connect wallet" (WalletStatus).
 */
interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly fixed: readonly FixedRow<Connector>[];
  readonly others: readonly OtherRow<Connector>[];
  readonly disclaimerUrl: string;
  /** A connection is being made or restored: no row can be pressed. */
  readonly busy: boolean;
}

type View = { readonly kind: "list" } | { readonly kind: "install"; readonly wallet: SupportedWallet };

const PHONE = "(max-width: 640px)";
const SWIPE_CLOSE_PX = 90;

export function WalletDialog({ open, onClose, fixed, others, disclaimerUrl, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const firstRow = useRef<HTMLButtonElement>(null);
  const installLink = useRef<HTMLAnchorElement>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [othersOpen, setOthersOpen] = useState(false);
  const connect = useConnect();
  const titleId = useId();
  const othersId = useId();

  useEffect(() => {
    const d = ref.current;
    if (d === null) return;
    if (open && !d.open) {
      setView({ kind: "list" });
      setOthersOpen(false);
      connect.reset();
      d.showModal();
      firstRow.current?.focus({ preventScroll: true });
    } else if (!open && d.open) {
      d.close();
    }
    // connect.reset is stable for this purpose; only the open flag drives the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (view.kind === "install") installLink.current?.focus({ preventScroll: true });
    else if (open) firstRow.current?.focus({ preventScroll: true });
  }, [view, open]);

  const pendingUid = connect.isPending ? uidOf(connect.variables.connector) : undefined;
  const locked = busy || connect.isPending;

  const choose = (connector: Connector) => {
    connect.mutate({ connector, chainId: chain.id });
  };

  // Swipe down to close (phones): only from the handle and the header, so the list keeps its own scroll.
  const drag = useRef<{ readonly y: number; readonly at: number } | null>(null);
  const move = (dy: number, animate: boolean) => {
    const p = panel.current;
    if (p === null) return;
    p.style.transition = animate ? "" : "none";
    p.style.transform = dy > 0 ? `translateY(${dy.toString()}px)` : "";
  };
  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia(PHONE).matches || (e.target as Element).closest("button") !== null) return;
    // No text selection or native drag while swiping (either would cancel the gesture).
    e.preventDefault();
    drag.current = { y: e.clientY, at: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current !== null) move(Math.max(0, e.clientY - drag.current.y), false);
  };
  const onDragEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === null) return;
    drag.current = null;
    const dy = Math.max(0, e.clientY - start.y);
    const speed = dy / Math.max(1, performance.now() - start.at);
    move(0, true);
    if (dy > SWIPE_CLOSE_PX || (dy > 24 && speed > 0.6)) onClose();
  };

  return (
    <dialog
      ref={ref}
      className="wd"
      aria-labelledby={titleId}
      onClose={() => {
        // Closed by any means (Escape, outside, button, swipe): the next opening starts on the list.
        setView({ kind: "list" });
        setOthersOpen(false);
        onClose();
      }}
      onClick={(e) => {
        // The dialog fills the screen and the panel sits inside it: a click on the dialog itself is outside the panel.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panel} className="wd__panel">
        <div
          className="wd__drag"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <span className="wd__grab" aria-hidden="true" />
          <div className="wd__head">
            {view.kind === "install" && (
              <button
                type="button"
                className="wd__icon-button"
                aria-label={t("wallet.back")}
                onClick={() => {
                  setView({ kind: "list" });
                }}
              >
                <Icon name="back" size={18} />
              </button>
            )}
            <h2 id={titleId} className={view.kind === "install" ? "wd__title wd__hidden" : "wd__title"}>
              {view.kind === "install" ? t("wallet.installTitle", { name: view.wallet.name }) : t("wallet.chooseTitle")}
            </h2>
            <button type="button" className="wd__icon-button" aria-label={t("wallet.close")} onClick={onClose}>
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        <div className="wd__body">
          {view.kind === "install" ? (
            <div className="wd__install">
              <span className="wd__biglogo">
                <img src={view.wallet.logo} alt="" width={72} height={72} />
              </span>
              <p className="wd__install-title" aria-hidden="true">
                {t("wallet.installTitle", { name: view.wallet.name })}
              </p>
              <p className="wd__install-text">{t("wallet.installText", { name: view.wallet.name })}</p>
              <a
                ref={installLink}
                className="ui-button ui-button--primary wd__install-button"
                href={view.wallet.installUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("wallet.installButton", { name: view.wallet.name })}
                <Icon name="out" size={16} />
              </a>
              <span className="wd__dest">
                <Icon name="lock" size={14} />
                {displayUrl(view.wallet.installUrl)}
              </span>
            </div>
          ) : (
            <>
              <ul className="wd__list">
                {fixed.map(({ wallet, connector, duplicated }, i) => (
                  <li key={wallet.name}>
                    {duplicated ? (
                      <div className="wd__row wd__row--warn">
                        <Logo src={wallet.logo} />
                        <span className="wd__text">
                          <span className="wd__name">{wallet.name}</span>
                          <span className="wd__sub">{t("wallet.duplicate", { name: wallet.name })}</span>
                        </span>
                      </div>
                    ) : (
                      <button
                        ref={i === 0 ? firstRow : undefined}
                        type="button"
                        className={connector !== undefined && connector.uid === pendingUid ? "wd__row is-pending" : "wd__row"}
                        disabled={locked}
                        onClick={() => {
                          if (connector === undefined) setView({ kind: "install", wallet });
                          else choose(connector);
                        }}
                      >
                        <Logo src={wallet.logo} />
                        <RowText name={wallet.name} pending={connector !== undefined && connector.uid === pendingUid} />
                        {connector !== undefined && <RowEnd pending={connector.uid === pendingUid} />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <div className="wd__sep" />
              <button
                type="button"
                className="wd__row"
                aria-expanded={othersOpen}
                aria-controls={othersId}
                onClick={() => {
                  setOthersOpen((v) => !v);
                }}
              >
                <span className="wd__logo wd__logo--plain">
                  <Icon name="grid" size={20} />
                </span>
                <span className="wd__text">
                  <span className="wd__name">{t("wallet.others")}</span>
                  <span className="wd__sub">{t("wallet.othersDesc")}</span>
                </span>
                <Icon name="chevron" size={18} className={othersOpen ? "wd__chevron is-open" : "wd__chevron"} />
              </button>
              <div id={othersId} className="wd__others" hidden={!othersOpen}>
                {others.length === 0 ? (
                  <p className="wd__empty">{t("wallet.othersNone")}</p>
                ) : (
                  <ul className="wd__list">
                    {others.map((o) => (
                      <li key={o.key}>
                        {o.state !== "ok" || o.connector === undefined ? (
                          <div className="wd__row wd__row--warn">
                            <span className="wd__logo wd__logo--warn">
                              <Icon name="alert" size={20} />
                            </span>
                            <span className="wd__text">
                              <span className="wd__name">{o.name}</span>
                              <span className="wd__sub">
                                {o.state === "duplicate"
                                  ? t("wallet.duplicate", { name: o.name })
                                  : t("wallet.imitation")}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <OtherButton row={o} connector={o.connector} pending={o.connector.uid === pendingUid} locked={locked} choose={choose} />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {connect.error !== null && (
                <p className="wd__error" role="alert">
                  {connect.error.name === "UserRejectedRequestError" ? t("wallet.rejected") : t("wallet.failed")}
                </p>
              )}
            </>
          )}
        </div>

        <p className="wd__legal">
          {rich("wallet.legal", {
            link: (
              <a href={disclaimerUrl} target="_blank" rel="noopener noreferrer">
                {t("wallet.legalLink")}
              </a>
            ),
          })}
        </p>
      </div>
    </dialog>
  );
}

function uidOf(c: unknown): string | undefined {
  return typeof c === "object" && c !== null && "uid" in c && typeof c.uid === "string" ? c.uid : undefined;
}

function Logo({ src }: { readonly src: string }) {
  return (
    <span className="wd__logo">
      <img src={src} alt="" width={40} height={40} />
    </span>
  );
}

function RowText({ name, pending }: { readonly name: string; readonly pending: boolean }) {
  return (
    <span className="wd__text">
      <span className="wd__name">{name}</span>
      {pending && <span className="wd__sub">{t("wallet.confirming")}</span>}
    </span>
  );
}

function RowEnd({ pending }: { readonly pending: boolean }) {
  return pending ? <span className="wd__spinner" aria-hidden="true" /> : <span className="wd__tag">{t("wallet.detected")}</span>;
}

function OtherButton({
  row,
  connector,
  pending,
  locked,
  choose,
}: {
  readonly row: OtherRow<Connector>;
  readonly connector: Connector;
  readonly pending: boolean;
  readonly locked: boolean;
  readonly choose: (c: Connector) => void;
}) {
  return (
    <button
      type="button"
      className={pending ? "wd__row is-pending" : "wd__row"}
      disabled={locked}
      onClick={() => {
        choose(connector);
      }}
    >
      {row.icon === null ? (
        <span className="wd__logo wd__logo--plain wd__initial" aria-hidden="true">
          {Array.from(row.name)[0]?.toUpperCase() ?? "?"}
        </span>
      ) : (
        <Logo src={row.icon} />
      )}
      <RowText name={row.name} pending={pending} />
      <RowEnd pending={pending} />
    </button>
  );
}
