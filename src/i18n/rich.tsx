import { Fragment, type ReactNode } from "react";
import { rawText, splitHoles, type MessageKey } from "./index";

/** Values of the placeholders that can be elements (amounts, addresses), besides text, numbers and bigint. */
export type RichParams = Readonly<Record<string, ReactNode | bigint>>;

/**
 * Text of a key with elements inside (e.g. "In your wallet: {amount}" with <Amount/>). The catalog texts
 * are never interpreted as HTML: only the {name} placeholders are replaced. `count` chooses the plural form.
 */
export function rich(key: MessageKey, params: RichParams): ReactNode {
  const c = params.count;
  const text = rawText(key, typeof c === "number" || typeof c === "bigint" ? c : undefined);
  return (
    <>
      {splitHoles(text).map((p, i) => {
        if (p.kind === "text") return <Fragment key={i}>{p.value}</Fragment>;
        if (!Object.hasOwn(params, p.name)) throw new Error(`Missing parameter ${p.name} for ${key}`);
        const v = params[p.name];
        return <Fragment key={i}>{typeof v === "bigint" ? v.toString() : v}</Fragment>;
      })}
    </>
  );
}
