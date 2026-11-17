// @ts-check
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { catalogImports, CheckError, compareLocale, holes, loadSource, run, sourceHash, TARGETS, textHoles } from "./i18n-check.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** @type {string[]} */
const temps = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

/** Copy of src/ and site/ in a temporary folder, to alter them without touching the repository. */
function copy() {
  const t = mkdtempSync(join(tmpdir(), "inheritfi-i18n-"));
  temps.push(t);
  cpSync(join(ROOT, "src"), join(t, "src"), { recursive: true });
  cpSync(join(ROOT, "site"), join(t, "site"), { recursive: true });
  return t;
}

/** @typedef {Record<string, { text: string | Record<string, string>; critical?: boolean }>} En */

/** @param {string} root @returns {En} */
function enOf(root) {
  /** @type {unknown} */
  const raw = JSON.parse(readFileSync(join(root, "src", "i18n", "en.json"), "utf8"));
  return /** @type {En} */ (raw);
}

/**
 * Complete and up-to-date translation of all of en.json (text copied from English, only for the test).
 * @param {ReturnType<typeof enOf>} en
 * @param {string} lang
 */
function fullTranslation(en, lang) {
  const req = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
  return Object.fromEntries(
    Object.entries(en).map(([k, v]) => {
      const text = typeof v.text === "string" ? v.text : Object.fromEntries(req.map((c) => [c, typeof v.text === "string" ? v.text : (v.text[c] ?? v.text.other ?? "")]));
      return [k, { text, source: sourceHash(v.text) }];
    }),
  );
}

/** @param {string} root @param {string[]} langs */
function activate(root, langs) {
  writeFileSync(join(root, "src", "i18n", "active.json"), JSON.stringify(["en", ...langs]));
  const imports = langs.map((l) => `import ${l.replace("-", "")} from "./locales/${l}.json";`).join("\n");
  const catalogs = readFileSync(join(root, "src", "i18n", "catalogs.ts"), "utf8").replace('import en from "./en.json";', `import en from "./en.json";\n${imports}`);
  writeFileSync(join(root, "src", "i18n", "catalogs.ts"), catalogs);
}

describe("i18n-check", () => {
  it("the current repository passes: every key is used and only English is active", () => {
    const r = run(ROOT);
    expect(r.errors).toEqual([]);
    expect(r.active).toEqual(["en"]);
    expect(r.keys).toBeGreaterThan(400);
  });

  it("the English fingerprint does not depend on the order of the plural forms", () => {
    expect(sourceHash({ one: "a", other: "b" })).toBe(sourceHash({ other: "b", one: "a" }));
    expect(sourceHash("a")).not.toBe(sourceHash("a "));
    expect(sourceHash("a")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("placeholders: sorted names; stray braces and plurals without 'other' or with invented categories fail", () => {
    expect(holes("x {b} y {a} {b}", "k")).toEqual(["a", "b"]);
    expect(() => holes("x { y", "k")).toThrow(CheckError);
    expect(() => holes("x {a b}", "k")).toThrow(CheckError);
    expect(textHoles({ one: "1 day", other: "{count} days" }, "k")).toEqual(["count"]);
    expect(() => textHoles({ one: "x" }, "k")).toThrow('the plural form "other" is missing');
    expect(() => textHoles({ other: "x", dual: "y" }, "k")).toThrow("unknown plural category");
    expect(() => textHoles({ one: "{a}", other: "{b}" }, "k")).toThrow("do not have the same placeholders");
    expect(() => textHoles("", "k")).toThrow("empty text");
  });

  it("en.json: keys in section.name format, only text and critical: true", () => {
    expect(() => loadSource({ Bad: { text: "x" } })).toThrow("invalid key");
    expect(() => loadSource({ "a.b": { text: "x", note: "y" } })).toThrow('unknown field "note"');
    expect(() => loadSource({ "a.b": { text: "x", critical: false } })).toThrow("critical can only be true");
    expect(() => loadSource({})).toThrow("it has no keys");
    expect(loadSource({ "a.b": { text: "x {n}", critical: true } }).get("a.b")).toEqual({ text: "x {n}", critical: true, holes: ["n"] });
  });

  it("translations: missing, extra, different placeholders, plurals of the language and outdated fingerprints", () => {
    const src = loadSource({ "a.crit": { text: "Fee {fee}", critical: true }, "a.norm": { text: "Hello" }, "a.pl": { text: { one: "{count} day", other: "{count} days" } } });
    const ok = { "a.crit": { text: "Comisión {fee}", source: sourceHash("Fee {fee}") }, "a.norm": { text: "Hola", source: sourceHash("Hello") }, "a.pl": { text: { one: "{count} día", many: "{count} de días", other: "{count} días" }, source: sourceHash({ one: "{count} day", other: "{count} days" }) } };
    expect(compareLocale("es", ok, src)).toEqual({ errors: [], missing: [], extra: [], outdatedCritical: [], outdatedNormal: [] });
    const r = compareLocale("es", { ...ok, "a.crit": { text: "Comisión", source: sourceHash("Fee {fee}") }, "x.y": { text: "z", source: sourceHash("z") } }, src);
    expect(r.errors.join(" ")).toContain("placeholders differ");
    expect(r.extra).toEqual(["x.y"]);
    const stale = compareLocale("es", { ...ok, "a.crit": { text: "Comisión {fee}", source: sourceHash("Old {fee}") }, "a.norm": { text: "Hola", source: sourceHash("Hi") } }, src);
    expect(stale.outdatedCritical).toEqual(["a.crit"]);
    expect(stale.outdatedNormal).toEqual(["a.norm"]);
    const missing = Object.fromEntries(Object.entries(ok).filter(([k]) => k !== "a.norm"));
    expect(compareLocale("es", missing, src).missing).toEqual(["a.norm"]);
    // Russian requires one, few, many and other.
    const ru = compareLocale("ru", { ...ok, "a.pl": { text: { one: "{count} день", other: "{count} дней" }, source: ok["a.pl"].source } }, src);
    expect(ru.errors.join(" ")).toContain("missing plural forms of ru: few, many");
  });

  it("catalogs.ts: reads the imported catalogs", () => {
    expect(catalogImports('import en from "./en.json";\nimport es from "./locales/es.json";\nimport type { Locale } from "./locales";')).toEqual(["en", "es"]);
  });

  it("fails if a key of en.json is not used in src/", () => {
    const root = copy();
    const en = enOf(root);
    writeFileSync(join(root, "src", "i18n", "en.json"), JSON.stringify({ ...en, "never.used": { text: "x" } }));
    expect(() => run(root)).toThrow("are not used in src/: never.used");
  });

  it("fails if active.json and catalogs.ts do not match, or if an active language has no file", () => {
    const root = copy();
    writeFileSync(join(root, "src", "i18n", "active.json"), JSON.stringify(["en", "es"]));
    expect(() => run(root)).toThrow("catalogs.ts imports [en] but active.json says [en, es]");
    activate(root, ["es"]);
    expect(run(root).errors).toContain("es: is active but src/i18n/locales/es.json does not exist");
    writeFileSync(join(root, "src", "i18n", "active.json"), JSON.stringify(["es", "en"]));
    expect(() => run(root)).toThrow('must be a list that starts with "en"');
    writeFileSync(join(root, "src", "i18n", "active.json"), JSON.stringify(["en", "fr"]));
    expect(() => run(root)).toThrow('language not programmed "fr"');
  });

  it("Spanish active: passes when up to date; a critical text changed in English fails; a normal one only warns; an inactive one is only reported", () => {
    const root = copy();
    const en = enOf(root);
    mkdirSync(join(root, "src", "i18n", "locales"));
    writeFileSync(join(root, "src", "i18n", "locales", "es.json"), JSON.stringify(fullTranslation(en, "es")));
    writeFileSync(join(root, "src", "i18n", "locales", "pt.json"), JSON.stringify({}));
    activate(root, ["es"]);
    const okRun = run(root);
    expect(okRun.errors).toEqual([]);
    expect(okRun.warnings).toEqual([]);
    expect(okRun.info.join(" ")).toContain(`(inactive) pt: missing ${String(Object.keys(en).length)}`);
    const plain = Object.entries(en).flatMap(([k, v]) => (typeof v.text === "string" ? [{ k, text: v.text, critical: v.critical === true }] : []));
    const crit = plain.find((x) => x.critical);
    const norm = plain.find((x) => !x.critical);
    if (crit === undefined || norm === undefined) throw new Error("no test texts");
    const changed = { ...en, [crit.k]: { text: `${crit.text} (changed)`, critical: true }, [norm.k]: { text: `${norm.text} (changed)` } };
    writeFileSync(join(root, "src", "i18n", "en.json"), JSON.stringify(changed));
    const r = run(root);
    expect(r.errors).toEqual([`es: CRITICAL texts pending re-review: ${crit.k}`]);
    expect(r.warnings).toEqual([`es: normal texts pending review: ${norm.k}`]);
  });

  it("site: the site/i18n catalog passes, its keys are searched for in site/ and not in src/", () => {
    const r = run(ROOT, TARGETS.site);
    expect(r.errors).toEqual([]);
    expect(r.active).toEqual(["en"]);
    expect(r.keys).toBeGreaterThan(100);
    const root = copy();
    /** @type {unknown} */
    const raw = JSON.parse(readFileSync(join(root, "site", "i18n", "en.json"), "utf8"));
    const en = /** @type {Record<string, unknown>} */ (raw);
    writeFileSync(join(root, "site", "i18n", "en.json"), JSON.stringify({ ...en, "never.used": { text: "x" } }));
    expect(() => run(root, TARGETS.site)).toThrow("are not used in site/: never.used");
    expect(run(root, TARGETS.app).errors).toEqual([]);
  });

  it("site: the site's active.json and catalogs.ts must match; an active language without a file fails", () => {
    const root = copy();
    writeFileSync(join(root, "site", "i18n", "active.json"), JSON.stringify(["en", "es"]));
    expect(() => run(root, TARGETS.site)).toThrow("site/i18n/catalogs.ts imports [en] but active.json says [en, es]");
    expect(run(root, TARGETS.app).errors).toEqual([]);
  });
});
