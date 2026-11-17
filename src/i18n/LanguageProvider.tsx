import { createContext, Fragment, useContext, useState, type ReactNode } from "react";
import { applyLocale, rememberLocale } from "./browser";
import { currentLocale, t } from "./index";
import { ACTIVE_LOCALES, LOCALES, type Locale } from "./locales";

interface LanguageState {
  locale: Locale;
  choose: (l: Locale) => void;
}

const LanguageContext = createContext<LanguageState | null>(null);

/**
 * Language of the interface. When it changes, everything inside is mounted again (texts are requested with t() when
 * rendering); the chain reads are kept in the query cache, outside this provider.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => currentLocale());
  const choose = (l: Locale) => {
    if (!ACTIVE_LOCALES.includes(l) || l === locale) return;
    applyLocale(l);
    rememberLocale(l);
    setLocaleState(l);
  };
  return (
    <LanguageContext.Provider value={{ locale, choose }}>
      <Fragment key={locale}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageState {
  const v = useContext(LanguageContext);
  if (v === null) throw new Error("useLanguage outside LanguageProvider");
  return v;
}

/** Language selector: it only appears with more than one active language; each language with its own name. */
export function LanguageSelect() {
  const { locale, choose } = useLanguage();
  if (ACTIVE_LOCALES.length < 2) return null;
  return (
    <label className="app__lang">
      <span className="app__lang-label">{t("nav.language")}</span>
      <select
        value={locale}
        onChange={(e) => {
          const next = ACTIVE_LOCALES.find((l) => l === e.target.value);
          if (next !== undefined) choose(next);
        }}
      >
        {ACTIVE_LOCALES.map((l) => (
          <option key={l} value={l} lang={l} dir={LOCALES[l].dir}>
            {LOCALES[l].name}
          </option>
        ))}
      </select>
    </label>
  );
}
