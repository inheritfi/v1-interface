// INHERITFI: texts of the interface (own mechanism, no libraries).
// - Reference catalog in English: src/i18n/en.json. Each key: { text, critical? }; `text` is a string with
//   {name} placeholders or, for plurals, an object per Intl.PluralRules category ("one", "other", …) chosen with `count`.
// - The translations (src/i18n/locales/<language>.json) store next to each text the fingerprint of the translated English text;
//   scripts/i18n-check.mjs compares them at build time (re-review rule).
// - t() returns plain text; to insert elements (amounts, addresses) rich() from ./rich is used.

import { CATALOGS, type Catalog, type MessageKey, type MessageText } from "./catalogs";
import { SOURCE_LOCALE, type Locale } from "./locales";

export type { MessageKey } from "./catalogs";

/** Values of the placeholders: text, number or bigint (written as they are, without language formatting). */
export type Params = Readonly<Record<string, string | number | bigint>>;

let locale: Locale = SOURCE_LOCALE;
let catalog: Catalog = CATALOGS[SOURCE_LOCALE];

export function currentLocale(): Locale {
  return locale;
}

/** Changes the language of t(). Only languages with a bundled catalog (active ones); the React provider calls it. */
export function setLocale(next: Locale): void {
  const c = CATALOGS[next];
  if (c === undefined) throw new Error(`Locale not available: ${next}`);
  locale = next;
  catalog = c;
}

/** Text according to the number (`count`): Intl.PluralRules category of the current language; if missing, "other". */
export function selectText(text: MessageText, count: number | bigint | undefined, lang: Locale, key: string): string {
  if (typeof text === "string") return text;
  if (count === undefined) throw new Error(`Missing count for ${key}`);
  const category = new Intl.PluralRules(lang).select(Number(count));
  return text[category] ?? text.other;
}

const HOLE = /\{(\w+)\}/g;

/** Parts of a text: literals and placeholder names, in order. */
export function splitHoles(text: string): ({ kind: "text"; value: string } | { kind: "hole"; name: string })[] {
  const out: ({ kind: "text"; value: string } | { kind: "hole"; name: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(HOLE)) {
    const name = m[1] ?? "";
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    out.push({ kind: "hole", name });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

/** Raw text (not filled) of a key in the current language. */
export function rawText(key: MessageKey, count?: number | bigint): string {
  return selectText(catalog[key].text, count, locale, key);
}

/** Text of a key with its placeholders filled. A placeholder without a value is a program error: it throws, it is not guessed. */
export function t(key: MessageKey, params?: Params): string {
  const c = params?.count;
  const text = rawText(key, typeof c === "string" ? undefined : c);
  return splitHoles(text)
    .map((p) => {
      if (p.kind === "text") return p.value;
      const v = params?.[p.name];
      if (v === undefined) throw new Error(`Missing parameter ${p.name} for ${key}`);
      return typeof v === "string" ? v : v.toString();
    })
    .join("");
}
