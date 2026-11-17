// INHERITFI: catalogs of the site (landing, documentation and legal pages), with the same format and the same rules
// as those of the app (src/i18n). Only the active languages of the site are imported (site/i18n/active.json); checked by
// scripts/i18n-check.mjs at build time.

import en from "./en.json";
import type { MessageText } from "../../src/i18n/catalogs";
import type { Locale } from "../../src/i18n/locales";

export type SiteKey = keyof typeof en;

export type SiteCatalog = Readonly<Record<SiteKey, { readonly text: MessageText }>>;

export const SITE_CATALOGS: Readonly<Partial<Record<Locale, SiteCatalog>>> & { readonly en: SiteCatalog } = {
  en,
};
