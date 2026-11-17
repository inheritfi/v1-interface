import { useLayoutEffect, useState } from "react";
import { formatBasisPoints } from "../lib/format";
import {
  addressErrorText,
  bpsToInput,
  overlap,
  splitEvenly,
  validateContacts,
  validateHeirs,
  type AddressCheck,
  type Hex40,
  type HeirRow,
  type ListContext,
  type PctCheck,
} from "../lib/heirs";
import { Button } from "./Button";
import { Notice } from "./Notice";
import { t } from "../i18n";
import { rich } from "../i18n/rich";

/** Full address, left to right and isolated from the text (in the confirmation it is never shortened). */
function FullAddress({ address }: { address: string }) {
  return (
    <bdi className="ui-mono ui-hash" dir="ltr">
      {address}
    </bdi>
  );
}

function addressError(a: AddressCheck | undefined): string | null {
  return a === undefined || a.ok ? null : addressErrorText(a.reason);
}

function pctError(p: PctCheck | undefined): string | null {
  return p === undefined || p.ok ? null : p.reason;
}

interface HeirsEditorProps {
  ctx: ListContext;
  current: readonly { wallet: Hex40; bps: bigint }[];
  maxHeirs: bigint;
  /** Current recovery contacts (to warn if an address is in both lists). */
  contacts: readonly string[];
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (value: { wallets: Hex40[]; bps: bigint[] }) => void;
}

/** Heirs editor: replaces the full list of the asset (setHeirs). Exact sum 100.00 %. */
export function HeirsEditor({ ctx, current, maxHeirs, contacts, disabled, onCancel, onSubmit }: HeirsEditorProps) {
  // Each row carries a stable key (not its position), so that React does not mix up rows when removing one.
  const [list, setList] = useState(() => {
    const initial: HeirRow[] = current.length > 0 ? current.map((h) => ({ address: h.wallet, percent: bpsToInput(h.bps) })) : [{ address: "", percent: "100.00" }];
    return { next: initial.length, rows: initial.map((r, i) => ({ ...r, key: i })) };
  });
  const rows = list.rows;
  const setRows = (next: (HeirRow & { key: number })[]) => {
    setList({ next: list.next, rows: next });
  };
  const [review, setReview] = useState(false);
  const [splitNote, setSplitNote] = useState<string | null>(null);
  const v = validateHeirs(rows, ctx, maxHeirs);
  const both = v.result.ok ? overlap(v.result.value.wallets, contacts) : [];
  const set = (i: number, patch: Partial<HeirRow>) => {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setSplitNote(null);
  };

  if (review && v.result.ok) {
    const value = v.result.value;
    return (
      <div className="ui-form">
        <p className="screen__note">{t("editor.heirsReview")}</p>
        <ol className="ui-review">
          {value.wallets.map((w, i) => (
            <li key={w}>
              <FullAddress address={w} /> <span className="ui-mono">{formatBasisPoints(value.bps[i] ?? 0n)}</span>
            </li>
          ))}
        </ol>
        {both.length > 0 && (
          <Notice tone="notice" title={t("editor.alsoContactTitle")}>
            {t("editor.alsoContact", { count: both.length })}
          </Notice>
        )}
        <div className="ui-actions">
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() => {
              onSubmit(value);
            }}
          >
            {t("editor.signHeirs")}
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              setReview(false);
            }}
          >
            {t("common.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="ui-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.result.ok && !disabled) setReview(true);
      }}
    >
      {rows.map((r, i) => (
        <div className="ui-list-row" key={r.key}>
          <input
            className="ui-input ui-input--address ui-mono"
            dir="ltr"
            aria-label={t("editor.heirAddress", { n: i + 1 })}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            value={r.address}
            disabled={disabled}
            onChange={(e) => {
              set(i, { address: e.target.value });
            }}
          />
          <div className="ui-form__row">
            <input
              className="ui-input ui-input--pct ui-mono"
              dir="ltr"
              inputMode="decimal"
              aria-label={t("editor.heirShare", { n: i + 1 })}
              autoComplete="off"
              value={r.percent}
              disabled={disabled}
              onChange={(e) => {
                set(i, { percent: e.target.value });
              }}
            />
            <span className="ui-form__symbol">%</span>
            <Button
              disabled={disabled || rows.length === 1}
              aria-label={t("editor.removeHeir", { n: i + 1 })}
              onClick={() => {
                setRows(rows.filter((_, j) => j !== i));
                setSplitNote(null);
              }}
            >
              {t("common.remove")}
            </Button>
          </div>
          {r.address !== "" && addressError(v.addresses[i]) !== null && <p className="ui-form__error">{addressError(v.addresses[i])}</p>}
          {r.percent !== "" && pctError(v.percents[i]) !== null && <p className="ui-form__error">{pctError(v.percents[i])}</p>}
        </div>
      ))}
      <div className="ui-actions">
        <Button
          disabled={disabled || BigInt(rows.length) >= maxHeirs}
          onClick={() => {
            setList({ next: list.next + 1, rows: [...rows, { address: "", percent: "", key: list.next }] });
            setSplitNote(null);
          }}
        >
          {t("editor.addHeir")}
        </Button>
        <Button
          disabled={disabled}
          onClick={() => {
            const shares = splitEvenly(rows.length);
            setRows(rows.map((r, i) => ({ ...r, percent: bpsToInput(shares[i] ?? 0n) })));
            const first = shares[0] ?? 0n;
            const other = shares[1];
            setSplitNote(
              other !== undefined && first !== other
                ? t("editor.splitNote", { first: formatBasisPoints(first), other: formatBasisPoints(other) })
                : null,
            );
          }}
        >
          {t("editor.split")}
        </Button>
      </div>
      {splitNote !== null && <p className="screen__note">{splitNote}</p>}
      <p className={v.total === 10_000n ? "screen__note" : "ui-form__error"}>
        {rich("editor.total", { total: <span className="ui-mono">{formatBasisPoints(v.total)}</span>, n: rows.length, max: maxHeirs })}
      </p>
      {!v.result.ok && rows.some((r) => r.address !== "") && <p className="ui-form__error">{v.result.reason}</p>}
      <div className="ui-actions">
        <Button type="submit" variant="primary" disabled={disabled || !v.result.ok}>
          {t("common.review")}
        </Button>
        <Button onClick={onCancel} disabled={disabled}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

interface ContactsEditorProps {
  ctx: ListContext;
  current: readonly Hex40[];
  maxRecoveryUsers: bigint;
  /** Current heirs (to warn if an address is in both lists). */
  heirs: readonly string[];
  /** Text of the contacts' power (periods and fee read from the contract). */
  power: string;
  disabled: boolean;
  /** Tells the screen whether the review step (the last one before signing) is being shown. */
  onReviewing: (reviewing: boolean) => void;
  onCancel: () => void;
  onSubmit: (wallets: Hex40[]) => void;
}

/** Recovery contacts editor: replaces the full list of the asset (setRecoveryUsers). */
export function ContactsEditor({ ctx, current, maxRecoveryUsers, heirs, power, disabled, onReviewing, onCancel, onSubmit }: ContactsEditorProps) {
  const [list, setList] = useState(() => {
    const initial = current.length > 0 ? [...current] : [""];
    return { next: initial.length, rows: initial.map((address, key) => ({ address, key })) };
  });
  const rows = list.rows;
  const setRows = (next: { address: string; key: number }[]) => {
    setList({ next: list.next, rows: next });
  };
  const [review, setReview] = useState(false);
  const v = validateContacts(
    rows.map((r) => r.address),
    ctx,
    maxRecoveryUsers,
  );
  const both = v.result.ok ? overlap(v.result.value, heirs) : [];
  // The review step repeats, as warnings, what the panel explains in its notes: the screen hides those notes meanwhile
  // (layout effect: the screen changes in the same paint as this editor, so both are never seen together).
  const reviewing = review && v.result.ok;
  useLayoutEffect(() => {
    onReviewing(reviewing);
    return () => {
      onReviewing(false);
    };
  }, [reviewing, onReviewing]);

  if (review && v.result.ok) {
    const value = v.result.value;
    return (
      <div className="ui-form">
        <Notice tone="notice" title={t("editor.contactsPowerTitle")}>
          {power}
        </Notice>
        <p className="screen__note">{t("editor.contactsReview")}</p>
        <ol className="ui-review">
          {value.map((w) => (
            <li key={w}>
              <FullAddress address={w} />
            </li>
          ))}
        </ol>
        {both.length > 0 && (
          <Notice tone="notice" title={t("editor.alsoHeirTitle")}>
            {t("editor.alsoHeir", { count: both.length })}
          </Notice>
        )}
        <div className="ui-actions">
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() => {
              onSubmit(value);
            }}
          >
            {t("editor.signContacts")}
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              setReview(false);
            }}
          >
            {t("common.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="ui-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.result.ok && !disabled) setReview(true);
      }}
    >
      {rows.map((r, i) => (
        <div className="ui-list-row" key={r.key}>
          <input
            className="ui-input ui-input--address ui-mono"
            dir="ltr"
            aria-label={t("editor.contactAddress", { n: i + 1 })}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            value={r.address}
            disabled={disabled}
            onChange={(e) => {
              setRows(rows.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)));
            }}
          />
          <div className="ui-form__row">
            <Button
              disabled={disabled || rows.length === 1}
              aria-label={t("editor.removeContact", { n: i + 1 })}
              onClick={() => {
                setRows(rows.filter((_, j) => j !== i));
              }}
            >
              {t("common.remove")}
            </Button>
          </div>
          {r.address !== "" && addressError(v.addresses[i]) !== null && <p className="ui-form__error">{addressError(v.addresses[i])}</p>}
        </div>
      ))}
      <div className="ui-actions">
        <Button
          disabled={disabled || BigInt(rows.length) >= maxRecoveryUsers}
          onClick={() => {
            setList({ next: list.next + 1, rows: [...rows, { address: "", key: list.next }] });
          }}
        >
          {t("editor.addContact")}
        </Button>
      </div>
      <p className="screen__note">
        {t("editor.contactsCount", { n: rows.length, max: maxRecoveryUsers })}
      </p>
      {!v.result.ok && rows.some((r) => r.address !== "") && <p className="ui-form__error">{v.result.reason}</p>}
      <div className="ui-actions">
        <Button type="submit" variant="primary" disabled={disabled || !v.result.ok}>
          {t("common.review")}
        </Button>
        <Button onClick={onCancel} disabled={disabled}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
