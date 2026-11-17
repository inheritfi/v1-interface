// INHERITFI: texts of the site. Same mechanism as the app (src/i18n): {name} placeholders, plurals with Intl.PluralRules and
// `count`; a placeholder without a value is a program error. The pages are generated as HTML at build time, one language at a time.

import { Fragment, type ReactNode } from "react";
import { selectText, splitHoles } from "../../src/i18n/index";
import { SOURCE_LOCALE, type Locale } from "../../src/i18n/locales";
import { SITE_CATALOGS, type SiteCatalog, type SiteKey } from "./catalogs";

export type { SiteKey } from "./catalogs";

let locale: Locale = SOURCE_LOCALE;
let catalog: SiteCatalog = SITE_CATALOGS[SOURCE_LOCALE];

export function siteLocale(): Locale {
  return locale;
}

/** Language of the pages generated next. Only languages with a bundled site catalog. */
export function setSiteLocale(next: Locale): void {
  const c = SITE_CATALOGS[next];
  if (c === undefined) throw new Error(`Site locale not available: ${next}`);
  locale = next;
  catalog = c;
}

export type SiteParams = Readonly<Record<string, string | number | bigint>>;
export type SiteRichParams = Readonly<Record<string, ReactNode | bigint>>;

function raw(key: SiteKey, count: unknown): string {
  return selectText(catalog[key].text, typeof count === "number" || typeof count === "bigint" ? count : undefined, locale, key);
}

/** Plain text of a site key. */
export function st(key: SiteKey, params?: SiteParams): string {
  return splitHoles(raw(key, params?.count))
    .map((p) => {
      if (p.kind === "text") return p.value;
      const v = params?.[p.name];
      if (v === undefined) throw new Error(`Missing parameter ${p.name} for ${key}`);
      return typeof v === "string" ? v : v.toString();
    })
    .join("");
}

/** Text with elements in the placeholders. The catalog text is never interpreted as HTML. */
export function srich(key: SiteKey, params: SiteRichParams): ReactNode {
  return splitHoles(raw(key, params.count)).map((p, i) => {
    if (p.kind === "text") return <Fragment key={i}>{p.value}</Fragment>;
    if (!Object.hasOwn(params, p.name)) throw new Error(`Missing parameter ${p.name} for ${key}`);
    const v = params[p.name];
    return <Fragment key={i}>{typeof v === "bigint" ? v.toString() : v}</Fragment>;
  });
}
