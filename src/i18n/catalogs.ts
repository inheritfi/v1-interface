// INHERITFI: bundled catalogs. Only the active languages are imported (src/i18n/active.json): an inactive language does not
// go into the bundle. scripts/i18n-check.mjs checks at build time that this list and active.json match.

import en from "./en.json";
import type { Locale } from "./locales";

/** Text of an entry: string with {name} placeholders, or an object per plural category (always with "other"). */
export type MessageText = string | (Partial<Record<Intl.LDMLPluralRule, string>> & { other: string });

export type MessageKey = keyof typeof en;

export type Catalog = Readonly<Record<MessageKey, { readonly text: MessageText }>>;

export const CATALOGS: Readonly<Partial<Record<Locale, Catalog>>> & { readonly en: Catalog } = {
  en,
};
