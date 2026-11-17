import { useId, useState } from "react";
import { formatExact, parseUnits } from "../lib/format";
import { Button } from "./Button";
import { t, type MessageKey } from "../i18n";

export interface AmountCheck {
  /** Text of the summary (what is sent and what is received) or reason why it is not possible to continue. */
  ok: boolean;
  text: string;
}

interface AmountFormProps {
  label: string;
  symbol: string;
  decimals: number;
  /** Maximum allowed (available balance). */
  max: bigint;
  /** Whether the "Max" button is offered. */
  offerMax: boolean;
  /** For ETH: computes Max leaving the reserve for the network fee; without this, Max = `max`. */
  onMax?: (() => Promise<{ ok: true; amount: bigint } | { ok: false; text: string }>) | undefined;
  check: (amount: bigint) => AmountCheck;
  disabled: boolean;
  submitLabel: string;
  onSubmit: (amount: bigint) => void;
  onCancel: () => void;
}

const PARSE_ERRORS: Record<"empty" | "format" | "precision", MessageKey> = {
  empty: "amount.empty",
  format: "amount.format",
  precision: "amount.precision",
};

/** Exact amount field (bigint): validates, shows the summary and only then allows continuing. */
export function AmountForm({ label, symbol, decimals, max, offerMax, onMax, check, disabled, submitLabel, onSubmit, onCancel }: AmountFormProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [maxMsg, setMaxMsg] = useState<string | null>(null);
  const [maxBusy, setMaxBusy] = useState(false);
  const parsed = parseUnits(text, decimals);
  let status: AmountCheck;
  if (!parsed.ok) status = { ok: false, text: t(PARSE_ERRORS[parsed.reason]) };
  else if (parsed.value === 0n) status = { ok: false, text: t("amount.zero") };
  else if (parsed.value > max) status = { ok: false, text: t("amount.tooLarge") };
  else status = check(parsed.value);

  return (
    <form
      className="ui-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed.ok && status.ok && !disabled) onSubmit(parsed.value);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="ui-form__row">
        <input
          id={id}
          className="ui-input ui-mono"
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.0"
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            setMaxMsg(null);
          }}
        />
        <span className="ui-form__symbol">{symbol}</span>
        {offerMax && (
          <Button
            disabled={disabled || maxBusy || (onMax === undefined && max === 0n)}
            onClick={() => {
              setMaxMsg(null);
              if (onMax === undefined) {
                setText(formatExact(max, decimals));
                return;
              }
              setMaxBusy(true);
              void onMax()
                .then((r) => {
                  if (r.ok) {
                    setText(formatExact(r.amount, decimals));
                  } else {
                    setText("");
                    setMaxMsg(r.text);
                  }
                })
                .finally(() => {
                  setMaxBusy(false);
                });
            }}
          >
            {t("amount.max")}
          </Button>
        )}
      </div>
      {maxMsg !== null && <p className="ui-form__error">{maxMsg}</p>}
      {text !== "" && <p className={status.ok ? "screen__note" : "ui-form__error"}>{status.text}</p>}
      <div className="ui-actions">
        <Button type="submit" variant="primary" disabled={disabled || !parsed.ok || !status.ok}>
          {submitLabel}
        </Button>
        <Button onClick={onCancel} disabled={disabled}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

