// INHERITFI: language in the browser. Only local reads (localStorage and navigator.languages); nothing leaves the browser.

import { setLocale } from "./index";
import { ACTIVE_LOCALES, LOCALES, pickLocale, type Locale } from "./locales";

/** Key where the language chosen in the selector is remembered (only in this browser). */
export const LOCALE_STORAGE_KEY = "inheritfi.locale";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, browser policy): it continues without remembering.
    return null;
  }
}

/** Applies a language: t(), lang and dir of the document. */
export function applyLocale(l: Locale): void {
  setLocale(l);
  document.documentElement.lang = l;
  document.documentElement.dir = LOCALES[l].dir;
}

/** Initial language: the one chosen before, if it is still active; if not, the browser's if it is active; if not, English. */
export function initLocale(): Locale {
  const l = pickLocale(readStored(), navigator.languages, ACTIVE_LOCALES);
  applyLocale(l);
  return l;
}

/** Remembers the user's choice in this browser (if storage is blocked, it only lasts for the session). */
export function rememberLocale(l: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, l);
  } catch {
    // Without storage: the choice holds until the page is closed.
  }
}
