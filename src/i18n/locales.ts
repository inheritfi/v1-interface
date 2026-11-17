import active from "./active.json";

// INHERITFI: languages of the interface.
// Programmed: the 10 of the policy. Active: only those that passed the native human review; an inactive language does not
// appear in the selector and its file does not go into the bundle (catalogs.ts only imports the active ones).

export const LOCALES = {
  en: { name: "English", dir: "ltr" },
  es: { name: "Español", dir: "ltr" },
  "zh-Hant": { name: "繁體中文", dir: "ltr" },
  pt: { name: "Português", dir: "ltr" },
  ar: { name: "العربية", dir: "rtl" },
  ru: { name: "Русский", dir: "ltr" },
  vi: { name: "Tiếng Việt", dir: "ltr" },
  tr: { name: "Türkçe", dir: "ltr" },
  ja: { name: "日本語", dir: "ltr" },
  ko: { name: "한국어", dir: "ltr" },
} as const;

export type Locale = keyof typeof LOCALES;

/** Reference language: every text is born in English and the translations store the fingerprint of the English text. */
export const SOURCE_LOCALE = "en" satisfies Locale;

export function isLocale(value: string): value is Locale {
  return Object.hasOwn(LOCALES, value);
}

/**
 * Active languages, in the order of the selector (src/i18n/active.json; checked by scripts/i18n-check.mjs at build time).
 * Activating one: native review → its file in src/i18n/locales/ → import it in catalogs.ts → add it to active.json.
 */
export const ACTIVE_LOCALES: readonly Locale[] = active.map((l) => {
  if (!isLocale(l)) throw new Error(`Unknown locale in active.json: ${l}`);
  return l;
});

/** Base language of a BCP 47 tag of the browser, as programmed: "es-MX" → es, "zh-TW" → zh-Hant (not zh-CN). */
function programmedFor(tag: string): Locale | null {
  const lower = tag.toLowerCase();
  const [base = "", ...rest] = lower.split("-");
  if (base === "zh") {
    // Only traditional Chinese: zh-Hant*, zh-TW, zh-HK and zh-MO. Simplified Chinese is not programmed.
    return rest.includes("hant") || rest.some((r) => r === "tw" || r === "hk" || r === "mo") ? "zh-Hant" : null;
  }
  return isLocale(base) ? base : null;
}

/**
 * Initial language: the one the user chose before in the selector, if it is still
 * active; if not, the first browser language that is active; if not, English. It never returns an inactive language.
 */
export function pickLocale(stored: string | null, browser: readonly string[], active: readonly Locale[] = ACTIVE_LOCALES): Locale {
  if (stored !== null && isLocale(stored) && active.includes(stored)) return stored;
  for (const tag of browser) {
    const l = programmedFor(tag);
    if (l !== null && active.includes(l)) return l;
  }
  return SOURCE_LOCALE;
}
