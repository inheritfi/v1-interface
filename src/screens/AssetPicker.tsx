import { AssetCombobox } from "../components/AssetCombobox";
import { formatUnits } from "../lib/format";
import type { AssetOverview } from "../web3/plan";
import { t } from "../i18n";

interface AssetPickerProps {
  rows: readonly AssetOverview[];
  selected: string;
  onSelect: (ticker: string) => void;
}

/** Text of each asset in the plan selector (unchanged from the previous selector). */
function line({ asset, balance, hasPlan }: AssetOverview): string {
  return `${asset.iToken.symbol}${balance > 0n ? ` · ${formatUnits(balance, asset.underlying.decimals, Math.min(4, asset.underlying.decimals))}` : ""}${hasPlan ? ` · ${t("picker.plan")}` : ""}`;
}

/** Asset selector of the plan, with search: first those that have balance or a plan. Each asset has its own plan. */
export function AssetPicker({ rows, selected, onSelect }: AssetPickerProps) {
  const current = rows.find((r) => r.asset.ticker === selected);
  return (
    <div className="screen__picker">
      <span aria-hidden="true">{t("picker.asset")}</span>
      <AssetCombobox
        label={t("picker.asset")}
        searchLabel={t("picker.search")}
        items={rows}
        assetOf={(r) => r.asset}
        selected={selected}
        renderSelected={() => <span className="ui-mono">{current === undefined ? selected : line(current)}</span>}
        renderItem={(r) => <span className="ui-mono">{line(r)}</span>}
        onSelect={onSelect}
      />
    </div>
  );
}
