import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { DeployedAsset } from "../contracts/types";
import { matchesAsset } from "../lib/assetSearch";
import { t } from "../i18n";

interface AssetComboboxProps<T> {
  /** Accessible text of the selector (e.g. "Asset") and of the search box ("Search asset by ticker"), already in the current language. */
  label: string;
  searchLabel: string;
  /** Rows in the order in which they are shown; each one with its asset. */
  items: readonly T[];
  assetOf: (item: T) => DeployedAsset;
  selected: string;
  /** Content of the closed box (the chosen asset). */
  renderSelected: () => ReactNode;
  /** Content of each row of the list. */
  renderItem: (item: T) => ReactNode;
  onSelect: (ticker: string) => void;
  /** Optional: group title of each row; a heading is shown each time it changes (the rows come already sorted). */
  groupOf?: (item: T) => string;
}

/**
 * Asset selector with search: closed, it shows the chosen asset and an arrow; open, a field that filters
 * while typing (ticker or iToken; the magnifier and Enter also work) and the list of supported assets.
 * Keyboard: arrows to move, Enter to choose, Esc to close. It only filters the list it receives.
 */
export function AssetCombobox<T>({ label, searchLabel, items, assetOf, selected, renderSelected, renderItem, onSelect, groupOf }: AssetComboboxProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const shown = items.filter((it) => matchesAsset(assetOf(it), query));
  const current = Math.min(active, Math.max(shown.length - 1, 0));
  const optionId = (i: number) => `${id}-opt-${String(i)}`;

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    setQuery("");
    setActive(0);
    if (focusTrigger) trigger.current?.focus();
  };
  const choose = (item: T | undefined) => {
    if (item === undefined) return;
    onSelect(assetOf(item).ticker);
    close(true);
  };

  // On open: focus on the search box. Click outside: close.
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (root.current !== null && e.target instanceof Node && !root.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
        setActive(0);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // The active option always visible when moving with the keyboard.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector(`[data-index="${String(current)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, current]);

  return (
    <div className="ui-combo" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="ui-combo__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("combo.trigger", { label, selected })}
        onClick={() => {
          if (open) close(false);
          else setOpen(true);
        }}
      >
        <span className="ui-combo__value">{renderSelected()}</span>
        <svg className="ui-combo__chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="ui-combo__popup">
          <form
            className="ui-combo__search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              choose(shown[current]);
            }}
          >
            <input
              ref={input}
              className="ui-input"
              type="text"
              role="combobox"
              aria-label={searchLabel}
              aria-expanded={true}
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={shown.length > 0 ? optionId(current) : undefined}
              placeholder={t("combo.placeholder")}
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive(Math.min(current + 1, shown.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(Math.max(current - 1, 0));
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  close(true);
                } else if (e.key === "Tab") {
                  close(false);
                }
              }}
            />
            <button type="submit" className="ui-combo__lens" aria-label={t("combo.search")}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" fill="none" strokeWidth="2" />
                <path d="m16 16 4.5 4.5" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </form>
          {shown.length === 0 ? (
            <p className="ui-combo__empty" role="status">
              {t("combo.noMatch", { query: query.trim() })}
            </p>
          ) : (
            <ul className="ui-combo__list" id={`${id}-list`} role="listbox" aria-label={label} ref={list}>
              {shown.map((it, i) => {
                const t = assetOf(it).ticker;
                const group = groupOf?.(it);
                const before = i > 0 ? shown[i - 1] : undefined;
                const prev = before !== undefined ? groupOf?.(before) : undefined;
                return (
                  <Fragment key={t}>
                    {group !== undefined && group !== prev && (
                      <li role="presentation" className="ui-combo__group">
                        {group}
                      </li>
                    )}
                  {/* It is chosen with the mouse here and with the keyboard from the search box (aria-activedescendant). */}
                  <li
                    id={optionId(i)}
                    data-index={i}
                    role="option"
                    aria-selected={t === selected}
                    className="ui-combo__option"
                    data-active={i === current}
                    onMouseMove={() => {
                      if (i !== current) setActive(i);
                    }}
                    onClick={() => {
                      choose(it);
                    }}
                  >
                    {renderItem(it)}
                  </li>
                  </Fragment>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
