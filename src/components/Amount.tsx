import { formatUnits } from "../lib/format";

interface AmountProps {
  value: bigint;
  decimals: number;
  symbol: string;
  fractionDigits?: number;
}

/** Exact amount (no upward rounding), fixed-width digits and always left to right. */
export function Amount({ value, decimals, symbol, fractionDigits = 6 }: AmountProps) {
  return (
    <bdi className="ui-mono ui-amount" dir="ltr">
      {formatUnits(value, decimals, Math.min(fractionDigits, decimals))} <span className="ui-amount__symbol">{symbol}</span>
    </bdi>
  );
}
