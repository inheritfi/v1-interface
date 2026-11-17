// @ts-check
/**
 * INHERITFI: writes the static site (dist-site/) from the two Vite builds (vite.site.config.ts):
 * the client bundle (dist-site/assets, with its manifest) and the SSR module (.site-ssr/render.js).
 * Then it checks the result and fails (code 1) if:
 *   - a page has inline scripts or styles (the CSP forbids them) or a <script> without src;
 *   - an internal link does not lead to a file that exists (except the pending pages of site/config.ts, PENDING_PAGES,
 *     which the mainnet build does not allow), or an anchor (#id) does not exist in its page;
 *   - an external link is not the app or an official account of the environment;
 *   - the JavaScript or the CSS of the site contain http(s) addresses or network functions (fetch, XMLHttpRequest,
 *     WebSocket, EventSource, sendBeacon): the site makes no requests; or embedded data: resources (the CSP blocks them);
 *   - the documentation search index is not exactly a JSON data assignment (no code).
 * At the end it deletes the Vite manifest and .site-ssr. No dependencies: only Node.
 */
import console from "node:console";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export class SiteError extends Error {}

/** @param {string} s */
const unescape = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");

/** Values of href and src of a page. @param {string} html */
export function links(html) {
  return [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => unescape(m[1] ?? ""));
}

/** id attributes of a page. @param {string} html */
export function ids(html) {
  return new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((m) => unescape(m[1] ?? "")));
}

/** CSP problems of a page (inline scripts or styles). @param {string} html */
export function inlineProblems(html) {
  /** @type {string[]} */
  const out = [];
  if (/\sstyle="/i.test(html)) out.push("inline style attribute");
  if (/<style[\s>]/i.test(html)) out.push("<style> element");
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? "";
    if (!/\ssrc="/.test(attrs)) out.push("<script> without src");
    if ((m[2] ?? "").trim() !== "") out.push("<script> with content");
  }
  if (/\son[a-z]+="/i.test(html)) out.push("inline event handler");
  if (/javascript:/i.test(html)) out.push("javascript: link");
  return out;
}

/** Output file that an internal path leads to ("/" → index.html, "/x/" → x/index.html). @param {string} path */
export function fileFor(path) {
  const clean = path.split("#")[0]?.split("?")[0] ?? "";
  if (!clean.startsWith("/") || clean.startsWith("//")) throw new SiteError(`invalid internal path: ${path}`);
  return clean.endsWith("/") ? `${clean.slice(1)}index.html` : clean.slice(1);
}

/** Network text forbidden in the JS or the CSS of the site. @param {string} text */
export function networkProblems(text) {
  /** @type {string[]} */
  const out = [];
  if (/https?:\/\//.test(text)) out.push("http(s) address");
  for (const w of ["fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "importScripts"]) if (text.includes(w)) out.push(w);
  if (/url\(\s*["']?data:/.test(text)) out.push("embedded data: resource (the CSP blocks it)");
  return out;
}

/**
 * Problems of the documentation search index: it must be exactly `prefix + JSON + ";\n"`, with a list
 * of { u, t, h, x } entries of text and internal /docs/ addresses. @param {string} text @param {string} prefix
 */
export function indexProblems(text, prefix) {
  if (!text.startsWith(prefix) || !text.endsWith(";\n")) return ["the index does not have the form prefix + JSON + ;"];
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(text.slice(prefix.length, -2));
  } catch {
    return ["the index is not JSON"];
  }
  if (!Array.isArray(data) || data.length === 0) return ["the index is not a list with entries"];
  /** @type {string[]} */
  const out = [];
  for (const item of /** @type {unknown[]} */ (data)) {
    const e = typeof item === "object" && item !== null ? /** @type {Record<string, unknown>} */ (item) : null;
    const ok = e !== null && Object.keys(e).sort().join() === "h,t,u,x" &&
      ["u", "t", "h", "x"].every((k) => typeof e[k] === "string" && e[k] !== "") && /^\/docs\/[a-z0-9/-]*(#[a-z0-9-]+)?$/.test(String(e.u));
    if (!ok) out.push(`invalid index entry: ${JSON.stringify(item).slice(0, 80)}`);
  }
  return out;
}

/**
 * Checks all the pages written.
 * @param {string} outDir
 * @param {{ file: string; html: string }[]} pages
 * @param {string[]} allowedExternal
 * @param {string} origin origin of the site: absolute links to it (canonical ones) are checked as internal
 * @param {readonly string[]} [pending] linked paths that do not exist yet and are accepted as they are (without anchors)
 */
export function checkSite(outDir, pages, allowedExternal, origin, pending = []) {
  /** @type {string[]} */
  const errors = [];
  const byFile = new Map(pages.map((p) => [p.file, p.html]));
  for (const { file, html } of pages) {
    for (const p of inlineProblems(html)) errors.push(`${file}: ${p}`);
    const own = ids(html);
    for (const found of links(html)) {
      const l = found.startsWith(`${origin}/`) ? found.slice(origin.length) : found;
      if (l.startsWith("#")) {
        if (!own.has(l.slice(1))) errors.push(`${file}: missing anchor ${l}`);
      } else if (/^https?:\/\//.test(l)) {
        if (!allowedExternal.includes(l)) errors.push(`${file}: external link not allowed ${l}`);
      } else if (l.startsWith("/") && !l.startsWith("//")) {
        if (pending.includes(l)) continue;
        const target = fileFor(l);
        if (!existsSync(join(outDir, target))) {
          errors.push(`${file}: broken link ${l}`);
          continue;
        }
        const hash = l.includes("#") ? l.slice(l.indexOf("#") + 1) : "";
        const targetHtml = byFile.get(target);
        if (hash !== "" && (targetHtml === undefined || !ids(targetHtml).has(hash))) errors.push(`${file}: missing anchor ${l}`);
      } else {
        errors.push(`${file}: link not allowed ${l}`);
      }
    }
  }
  return errors;
}

/** Files of a directory, with relative paths and sorted. @param {string} dir */
export function listFiles(dir) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} d */
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out.sort();
}

/** @param {string} root @param {string} env */
export async function prerender(root, env) {
  const outDir = join(root, "dist-site");
  const ssr = join(root, ".site-ssr", "render.js");
  const manifestFile = join(outDir, ".vite", "manifest.json");
  if (!existsSync(manifestFile)) throw new SiteError("dist-site/.vite/manifest.json is missing (was the site client built?)");
  if (!existsSync(ssr)) throw new SiteError(".site-ssr/render.js is missing (was the SSR step built?)");
  /** @type {unknown} */
  const parsed = JSON.parse(readFileSync(manifestFile, "utf8"));
  const manifest = /** @type {Record<string, { file: string; css?: string[]; isEntry?: boolean } | undefined>} */ (parsed);
  const entry = manifest["site/client/main.ts"];
  if (entry?.isEntry !== true || entry.css?.length !== 1) throw new SiteError("the manifest does not have the site/client/main.ts entry with one CSS");
  /** @type {unknown} */
  const loaded = await import(pathToFileURL(ssr).href);
  const mod = /** @type {{ PAGES: readonly { path: string | null; file: string }[]; renderPage: (i: object) => string; allowedExternal: (env: string) => string[]; siteOrigin: (env: string) => string; pendingPages: (env: string) => string[]; docsSearchIndex: (env: string) => unknown[]; DOCS_INDEX_FILE: string; DOCS_INDEX_PREFIX: string }} */ (loaded);
  const css = (entry.css ?? []).map((c) => `/${c}`);
  const js = `/${entry.file}`;
  /** @type {{ file: string; html: string }[]} */
  const pages = [];
  for (const page of mod.PAGES) {
    const html = mod.renderPage({ env, page, css, js });
    const target = join(outDir, page.file);
    if (existsSync(target)) throw new SiteError(`${page.file} already exists in dist-site (it collides with a public file)`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, html);
    pages.push({ file: page.file, html });
  }
  const indexFile = join(outDir, mod.DOCS_INDEX_FILE);
  if (existsSync(indexFile)) throw new SiteError(`${mod.DOCS_INDEX_FILE} already exists in dist-site (it collides with a public file)`);
  mkdirSync(dirname(indexFile), { recursive: true });
  writeFileSync(indexFile, `${mod.DOCS_INDEX_PREFIX}${JSON.stringify(mod.docsSearchIndex(env))};\n`);
  const origin = mod.siteOrigin(env);
  const urls = mod.PAGES.flatMap((p) => (p.path === null ? [] : [`  <url><loc>${origin}${p.path}</loc></url>`]));
  writeFileSync(join(outDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  writeFileSync(join(outDir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  rmSync(join(outDir, ".vite"), { recursive: true });
  rmSync(join(root, ".site-ssr"), { recursive: true });

  const pending = mod.pendingPages(env);
  for (const p of pending) if (existsSync(join(outDir, fileFor(p)))) throw new SiteError(`${p} is listed as pending but already exists: remove it from PENDING_PAGES`);
  const errors = checkSite(outDir, pages, mod.allowedExternal(env), origin, pending);
  const files = listFiles(outDir);
  for (const f of files.filter((x) => /\.(js|css)$/.test(x))) {
    const text = readFileSync(join(outDir, f), "utf8");
    // The index is documentation text (it includes, e.g., the Licensor "https://inheritfi.com"): it is checked that
    // it is only data, instead of searching for addresses as in the code.
    const problems = f === mod.DOCS_INDEX_FILE ? indexProblems(text, mod.DOCS_INDEX_PREFIX) : networkProblems(text);
    for (const p of problems) errors.push(`${f}: ${p}`);
  }
  const bytes = files.reduce((n, f) => n + statSync(join(outDir, f)).size, 0);
  return { errors, pages: pages.map((p) => p.file), files, bytes, pending };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const env = process.env.INHERITFI_ENV ?? "mainnet";
  try {
    const r = await prerender(root, env);
    if (r.errors.length > 0) {
      for (const e of r.errors) console.error(`ERROR: ${e}`);
      process.exit(1);
    }
    const assets = r.files.filter((f) => /^assets\/.*\.(js|css)$/.test(f)).map((f) => f.slice(7));
    const fonts = r.files.filter((f) => f.endsWith(".woff2")).length;
    console.log(`SITE OK (${env}): ${String(r.pages.length)} pages (${r.pages.join(", ")}); ${assets.join(", ")}; woff2: ${String(fonts)}; ${String(r.files.length)} files; pending: ${r.pending.join(", ") || "none"}`);
  } catch (e) {
    console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
