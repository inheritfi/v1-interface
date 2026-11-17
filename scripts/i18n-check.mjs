// @ts-check
/**
 * INHERITFI: checks the interface texts before building (language policy). Fails (code 1) if:
 *   - src/i18n/en.json does not have the agreed shape: { key: { text, critical? } }; `text` is a string or a plural
 *     object with "other" and only Intl.PluralRules categories; well-formed {name} placeholders, the same in every form;
 *   - a key of en.json does not appear literally in the code of src/ (keys are never built on the fly);
 *   - src/i18n/active.json is not a list of programmed languages starting with "en", or src/i18n/catalogs.ts does not
 *     import exactly the catalogs of those languages;
 *   - an ACTIVE language does not have all the keys of en.json, has extra keys, changes the placeholders, lacks plural
 *     forms of its language, or a CRITICAL text was translated from an English text that has since changed (different fingerprint).
 * Warns, without failing, if a normal text of an active language is out of date. Inactive languages are only reported.
 *
 * The same rules apply, separately, to the texts of the public site (site/i18n: en.json, active.json,
 * catalogs.ts and locales/), whose keys must be used in the code of site/.
 *
 * Each translation stores { text, source }: `source` is the SHA-256 fingerprint of the English text that was translated
 * (sourceHash). `node scripts/i18n-check.mjs --hash key` prints the current fingerprint of a key.
 *
 * No dependencies: only Node.
 */
import console from "node:console";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const PROGRAMMED = /** @type {const} */ (["en", "es", "zh-Hant", "pt", "ar", "ru", "vi", "tr", "ja", "ko"]);
export const PLURAL_CATEGORIES = /** @type {const} */ (["zero", "one", "two", "few", "many", "other"]);
const KEY = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;
const HOLE = /\{(\w+)\}/g;

export class CheckError extends Error {}

/** @typedef {string | Record<string, string>} Text */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** Fingerprint of the English text: SHA-256 of the canonical JSON (plural forms sorted by name). @param {Text} text */
export function sourceHash(text) {
  const canon = typeof text === "string" ? JSON.stringify(text) : JSON.stringify(Object.fromEntries(Object.entries(text).sort(([a], [b]) => a.localeCompare(b))));
  return createHash("sha256").update(canon, "utf8").digest("hex");
}

/** Names of the placeholders of a string, sorted and without repeats; error if there are stray braces. @param {string} s @param {string} where */
export function holes(s, where) {
  const names = [...s.matchAll(HOLE)].map((m) => m[1] ?? "");
  const rest = s.replace(HOLE, "");
  if (rest.includes("{") || rest.includes("}")) throw new CheckError(`${where}: stray brace or malformed placeholder`);
  return [...new Set(names)].sort();
}

/** Placeholders of a text (all forms must have the same ones). @param {unknown} text @param {string} where */
export function textHoles(text, where) {
  if (typeof text === "string") {
    if (text === "") throw new CheckError(`${where}: empty text`);
    return holes(text, where);
  }
  if (!isObj(text)) throw new CheckError(`${where}: text must be a string or a plural object`);
  if (typeof text.other !== "string") throw new CheckError(`${where}: the plural form "other" is missing`);
  let ref = /** @type {string[] | null} */ (null);
  for (const [cat, v] of Object.entries(text)) {
    if (!PLURAL_CATEGORIES.includes(/** @type {never} */ (cat))) throw new CheckError(`${where}: unknown plural category "${cat}"`);
    if (typeof v !== "string" || v === "") throw new CheckError(`${where}.${cat}: empty text or not a string`);
    const h = holes(v, `${where}.${cat}`).filter((x) => x !== "count");
    if (ref !== null && ref.join(",") !== h.join(",")) throw new CheckError(`${where}: the plural forms do not have the same placeholders`);
    ref = h;
  }
  return [...(ref ?? []), "count"].sort();
}

/**
 * Validated English catalog: key → { text, critical, holes }.
 * @param {unknown} json
 * @returns {Map<string, { text: Text; critical: boolean; holes: string[] }>}
 */
export function loadSource(json) {
  if (!isObj(json)) throw new CheckError("en.json: must be an object");
  /** @type {Map<string, { text: Text; critical: boolean; holes: string[] }>} */
  const out = new Map();
  for (const [key, entry] of Object.entries(json)) {
    if (!KEY.test(key)) throw new CheckError(`en.json: invalid key "${key}" (format section.name)`);
    if (!isObj(entry)) throw new CheckError(`en.json ${key}: must be an object { text, critical? }`);
    for (const f of Object.keys(entry)) if (f !== "text" && f !== "critical") throw new CheckError(`en.json ${key}: unknown field "${f}"`);
    if (entry.critical !== undefined && entry.critical !== true) throw new CheckError(`en.json ${key}: critical can only be true`);
    const h = textHoles(entry.text, `en.json ${key}`);
    out.set(key, { text: /** @type {Text} */ (entry.text), critical: entry.critical === true, holes: h });
  }
  if (out.size === 0) throw new CheckError("en.json: it has no keys");
  return out;
}

/**
 * Compares a translation with the English text.
 * @param {string} lang
 * @param {unknown} json
 * @param {ReturnType<typeof loadSource>} source
 */
export function compareLocale(lang, json, source) {
  if (!isObj(json)) throw new CheckError(`${lang}.json: must be an object`);
  const required = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
  /** @type {{ errors: string[]; missing: string[]; extra: string[]; outdatedCritical: string[]; outdatedNormal: string[] }} */
  const r = { errors: [], missing: [], extra: [], outdatedCritical: [], outdatedNormal: [] };
  for (const key of source.keys()) if (!Object.hasOwn(json, key)) r.missing.push(key);
  for (const [key, entry] of Object.entries(json)) {
    const src = source.get(key);
    if (src === undefined) {
      r.extra.push(key);
      continue;
    }
    try {
      if (!isObj(entry)) throw new CheckError(`${lang}.json ${key}: must be an object { text, source }`);
      for (const f of Object.keys(entry)) if (f !== "text" && f !== "source") throw new CheckError(`${lang}.json ${key}: unknown field "${f}"`);
      if (typeof entry.source !== "string" || !/^[0-9a-f]{64}$/.test(entry.source)) throw new CheckError(`${lang}.json ${key}: source must be the SHA-256 fingerprint of the English text`);
      if ((typeof src.text === "string") !== (typeof entry.text === "string")) throw new CheckError(`${lang}.json ${key}: the English text ${typeof src.text === "string" ? "is not" : "is"} plural`);
      const h = textHoles(entry.text, `${lang}.json ${key}`);
      if (h.join(",") !== src.holes.join(",")) throw new CheckError(`${lang}.json ${key}: placeholders differ from the English text (${h.join(", ")} ≠ ${src.holes.join(", ")})`);
      if (isObj(entry.text)) {
        const lacking = required.filter((c) => !Object.hasOwn(/** @type {object} */ (entry.text), c));
        if (lacking.length > 0) throw new CheckError(`${lang}.json ${key}: missing plural forms of ${lang}: ${lacking.join(", ")}`);
      }
      if (entry.source !== sourceHash(src.text)) (src.critical ? r.outdatedCritical : r.outdatedNormal).push(key);
    } catch (e) {
      r.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return r;
}

/**
 * Keys of en.json that do not appear literally ("key" or 'key') in the code of a folder (.ts/.tsx, without the tests).
 * @param {string} root @param {Iterable<string>} keys @param {string} [scan] folder checked (src or site)
 */
export function unusedKeys(root, keys, scan = "src") {
  /** @type {string[]} */
  const texts = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) texts.push(readFileSync(p, "utf8"));
    }
  };
  walk(join(root, scan));
  const all = texts.join("\n");
  return [...keys].filter((k) => !all.includes(`"${k}"`) && !all.includes(`'${k}'`));
}

/** Languages that src/i18n/catalogs.ts imports (en and ./locales/<language>.json). @param {string} text */
export function catalogImports(text) {
  const out = [];
  for (const m of text.matchAll(/^import\s+(\w+)\s+from\s+"\.\/(?:locales\/)?([\w-]+)\.json";$/gm)) out.push(m[2] ?? "");
  return out;
}

/** Catalogs that are checked: those of the app (src) and those of the public site (site). */
export const TARGETS = /** @type {const} */ ({ app: { i18n: "src/i18n", scan: "src" }, site: { i18n: "site/i18n", scan: "site" } });

/** @param {string} root @param {{ i18n: string; scan: string }} [target] */
export function run(root, target = TARGETS.app) {
  const rel = target.i18n;
  const dir = join(root, ...rel.split("/"));
  const source = loadSource(JSON.parse(readFileSync(join(dir, "en.json"), "utf8")));
  /** @type {unknown} */
  const parsed = JSON.parse(readFileSync(join(dir, "active.json"), "utf8"));
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed[0] !== "en") throw new CheckError(`${rel}/active.json: must be a list that starts with "en"`);
  /** @type {string[]} */
  const active = [];
  for (const l of /** @type {unknown[]} */ (parsed)) {
    if (typeof l !== "string" || !PROGRAMMED.includes(/** @type {never} */ (l))) throw new CheckError(`${rel}/active.json: language not programmed "${String(l)}"`);
    active.push(l);
  }
  if (new Set(active).size !== active.length) throw new CheckError(`${rel}/active.json: repeated languages`);
  const imported = catalogImports(readFileSync(join(dir, "catalogs.ts"), "utf8"));
  if ([...imported].sort().join(",") !== [...active].sort().join(",")) throw new CheckError(`${rel}/catalogs.ts imports [${imported.join(", ")}] but active.json says [${active.join(", ")}]`);
  const unused = unusedKeys(root, source.keys(), target.scan);
  if (unused.length > 0) throw new CheckError(`keys of en.json that are not used in ${target.scan}/: ${unused.join(", ")}`);
  const localesDir = join(dir, "locales");
  const files = existsSync(localesDir) ? readdirSync(localesDir).filter((f) => f.endsWith(".json")) : [];
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const info = [];
  for (const l of active) if (l !== "en" && !files.includes(`${l}.json`)) errors.push(`${l}: is active but ${rel}/locales/${l}.json does not exist`);
  for (const f of files) {
    const lang = f.slice(0, -5);
    if (lang === "en" || !PROGRAMMED.includes(/** @type {never} */ (lang))) {
      errors.push(`${relative(root, join(localesDir, f))}: language not programmed`);
      continue;
    }
    const r = compareLocale(lang, JSON.parse(readFileSync(join(localesDir, f), "utf8")), source);
    const isActive = active.includes(lang);
    const summary = `${lang}: missing ${String(r.missing.length)}, extra ${String(r.extra.length)}, critical out of date ${String(r.outdatedCritical.length)}, normal out of date ${String(r.outdatedNormal.length)}, errors ${String(r.errors.length)}`;
    if (!isActive) {
      info.push(`(inactive) ${summary}`);
      continue;
    }
    errors.push(...r.errors);
    if (r.missing.length > 0) errors.push(`${lang}: missing keys: ${r.missing.join(", ")}`);
    if (r.extra.length > 0) errors.push(`${lang}: keys that do not exist in English: ${r.extra.join(", ")}`);
    if (r.outdatedCritical.length > 0) errors.push(`${lang}: CRITICAL texts pending re-review: ${r.outdatedCritical.join(", ")}`);
    if (r.outdatedNormal.length > 0) warnings.push(`${lang}: normal texts pending review: ${r.outdatedNormal.join(", ")}`);
  }
  return { keys: source.size, critical: [...source.values()].filter((v) => v.critical).length, active, errors, warnings, info };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  try {
    const at = process.argv.indexOf("--hash");
    if (at !== -1) {
      const key = process.argv[at + 1] ?? "";
      const entry =
        loadSource(JSON.parse(readFileSync(join(root, "src", "i18n", "en.json"), "utf8"))).get(key) ??
        loadSource(JSON.parse(readFileSync(join(root, "site", "i18n", "en.json"), "utf8"))).get(key);
      if (entry === undefined) throw new CheckError(`the key "${key}" does not exist`);
      console.log(sourceHash(entry.text));
    } else {
      const r = run(root, TARGETS.app);
      const site = run(root, TARGETS.site);
      for (const i of r.info) console.log(i);
      for (const i of site.info) console.log(`site ${i}`);
      for (const w of r.warnings) console.warn(`WARNING: ${w}`);
      for (const w of site.warnings) console.warn(`WARNING (site): ${w}`);
      if (r.errors.length > 0 || site.errors.length > 0) {
        for (const e of r.errors) console.error(`ERROR: ${e}`);
        for (const e of site.errors) console.error(`ERROR (site): ${e}`);
        process.exit(1);
      }
      console.log(`TEXTS OK: ${String(r.keys)} keys (${String(r.critical)} critical); active languages: ${r.active.join(", ")}`);
      console.log(`SITE TEXTS OK: ${String(site.keys)} keys (${String(site.critical)} critical); active languages: ${site.active.join(", ")}`);
    }
  } catch (e) {
    console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
