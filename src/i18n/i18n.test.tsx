import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "./en.json";
import { currentLocale, selectText, setLocale, splitHoles, t } from "./index";
import { ACTIVE_LOCALES, isLocale, LOCALES, pickLocale, SOURCE_LOCALE } from "./locales";
import { rich } from "./rich";

describe("t()", () => {
  it("returns the English text with its placeholders filled (text, number and bigint)", () => {
    expect(t("common.tryAgain")).toBe("Try again");
    expect(t("wallet.switchTitle", { name: "Ethereum", chain: 1 })).toBe("Switch the wallet to Ethereum (chain 1)");
    expect(t("heirs.tooMany", { max: 10n })).toBe("The protocol allows at most 10 heirs.");
  });

  it("chooses the plural form with Intl.PluralRules (English: 1 → one; 0 and 2 → other)", () => {
    expect(t("time.days", { count: 1n })).toBe("1 day");
    expect(t("time.days", { count: 2n })).toBe("2 days");
    expect(t("plan.both", { count: 1 })).toBe("One address is both an heir and a recovery contact.");
    expect(t("plan.both", { count: 3 })).toBe("3 addresses are both an heir and a recovery contact.");
    expect(t("tx.notSentAfter", { count: 0 })).toBe("The 0 after it weren't sent.");
  });

  it("a placeholder without a value or a plural without count is a program error (it is not guessed)", () => {
    expect(() => t("wallet.switchTitle", { name: "x" })).toThrow("Missing parameter chain for wallet.switchTitle");
    expect(() => t("time.days")).toThrow("Missing count for time.days");
  });

  it("the default language is English and it can only be changed to a language with a bundled catalog", () => {
    expect(currentLocale()).toBe("en");
    expect(() => {
      setLocale("es");
    }).toThrow("Locale not available: es");
    expect(currentLocale()).toBe("en");
  });

  it("selectText uses 'other' if the language asks for a category that the text does not have", () => {
    expect(selectText({ other: "x {count}" }, 1, "en", "k")).toBe("x {count}");
    expect(selectText({ one: "uno", other: "otros" }, 1, "es", "k")).toBe("uno");
  });

  it("splitHoles separates literals and placeholders in order", () => {
    expect(splitHoles("a {b} c {d}")).toEqual([
      { kind: "text", value: "a " },
      { kind: "hole", name: "b" },
      { kind: "text", value: " c " },
      { kind: "hole", name: "d" },
    ]);
    expect(splitHoles("{x}")).toEqual([{ kind: "hole", name: "x" }]);
  });

  it("no key of the catalog is empty and all of them have text", () => {
    for (const [k, v] of Object.entries(en)) {
      expect(k).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/);
      expect(v.text).toBeTruthy();
    }
  });
});

describe("rich()", () => {
  it("inserts elements in the placeholders and never interprets the text as HTML", () => {
    expect(renderToStaticMarkup(<p>{rich("common.inWallet", { amount: <b>1 ETH</b> })}</p>)).toBe("<p>In your wallet: <b>1 ETH</b></p>");
    expect(renderToStaticMarkup(<p>{rich("common.inWallet", { amount: "<script>x</script>" })}</p>)).toBe("<p>In your wallet: &lt;script&gt;x&lt;/script&gt;</p>");
  });

  it("a placeholder without a value is an error", () => {
    expect(() => renderToStaticMarkup(<p>{rich("common.inWallet", {})}</p>)).toThrow("Missing parameter amount for common.inWallet");
  });
});

describe("languages", () => {
  it("10 programmed languages; only English active for now; Arabic right to left", () => {
    expect(Object.keys(LOCALES)).toEqual(["en", "es", "zh-Hant", "pt", "ar", "ru", "vi", "tr", "ja", "ko"]);
    expect(ACTIVE_LOCALES).toEqual(["en"]);
    expect(SOURCE_LOCALE).toBe("en");
    expect(Object.entries(LOCALES).filter(([, v]) => v.dir === "rtl").map(([k]) => k)).toEqual(["ar"]);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("zh")).toBe(false);
    expect(isLocale("toString")).toBe(false);
  });

  it("initial language: the one chosen before if it is still active; if not, the browser's if it is active; if not, English", () => {
    const both = ["en", "es"] as const;
    expect(pickLocale("es", ["en-US"], both)).toBe("es");
    expect(pickLocale(null, ["es-MX", "en"], both)).toBe("es");
    expect(pickLocale(null, ["fr-FR", "es"], both)).toBe("es");
    expect(pickLocale(null, ["fr-FR"], both)).toBe("en");
    expect(pickLocale("en", ["es-ES"], both)).toBe("en");
  });

  it("never returns an inactive language, even if it is stored or the browser asks for it", () => {
    expect(pickLocale("es", ["es-MX"], ["en"])).toBe("en");
    expect(pickLocale("ar", ["ar-SA"], ["en", "es"])).toBe("en");
    expect(pickLocale("none", ["xx"], ["en"])).toBe("en");
  });

  it("Chinese: only traditional (zh-Hant, zh-TW, zh-HK, zh-MO); zh-CN and zh do not count", () => {
    const zh = ["en", "zh-Hant"] as const;
    expect(pickLocale(null, ["zh-TW"], zh)).toBe("zh-Hant");
    expect(pickLocale(null, ["zh-Hant-HK"], zh)).toBe("zh-Hant");
    expect(pickLocale(null, ["zh-hk"], zh)).toBe("zh-Hant");
    expect(pickLocale(null, ["zh-CN"], zh)).toBe("en");
    expect(pickLocale(null, ["zh"], zh)).toBe("en");
  });
});
