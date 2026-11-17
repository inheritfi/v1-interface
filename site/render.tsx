// INHERITFI: generation of the static site. scripts/prerender-site.mjs imports this module (built by Vite in
// SSR mode) and writes one HTML file per page. None of this reaches the browser as JavaScript.

import { renderToStaticMarkup } from "react-dom/server";
import { setLocale } from "../src/i18n/index";
import { setSiteLocale, st } from "./i18n";
import { COPYRIGHT_YEAR, isSiteEnv, PENDING_PAGES, siteConfig, socialOf } from "./config";
import { protocolParams } from "./params";
import { Layout, type PageAssets } from "./pages/Layout";
import { Home } from "./pages/Home";
import { Disclaimer } from "./pages/Disclaimer";
import { NotFound } from "./pages/NotFound";
import { DocsPage, docModule } from "./pages/Docs";
import { docsData } from "./docs/data";
import { DOC_PAGES } from "./docs/outline";

export { CSP } from "./pages/Layout";

/** External links that may appear in the pages of an environment (the app and the official accounts). */
export function allowedExternal(env: string): string[] {
  if (!isSiteEnv(env)) throw new Error(`Unknown env ${env}`);
  const c = siteConfig(env);
  const s = socialOf(c);
  return [c.appUrl, s.x, s.discord, s.github];
}

/** Linked paths that do not exist yet (config.ts): the link check accepts them. On mainnet there are none. */
export function pendingPages(env: string): string[] {
  if (!isSiteEnv(env)) throw new Error(`Unknown env ${env}`);
  siteConfig(env);
  return [...PENDING_PAGES];
}

/** Origin of the site in an environment (for the sitemap). */
export function siteOrigin(env: string): string {
  if (!isSiteEnv(env)) throw new Error(`Unknown env ${env}`);
  return siteConfig(env).origin;
}

export interface SitePage {
  readonly path: string | null;
  readonly file: string;
  /** Only the documentation pages: identifier of the page (site/docs/outline.ts). */
  readonly doc?: string;
}

/** Documentation search index: a data file that only its pages load (the CSP forbids fetch). */
export const DOCS_INDEX_FILE = "docs/search-index.js";
export const DOCS_INDEX_PREFIX = "window.INHERITFI_DOCS_INDEX = ";

/** Pages of the site: public path → output file. They all load the client script (menu and animations). */
export const PAGES: readonly SitePage[] = [
  { path: "/", file: "index.html" },
  { path: "/disclaimer/", file: "disclaimer/index.html" },
  ...DOC_PAGES.map((p) => ({ path: p.path, file: `${p.path.slice(1)}index.html`, doc: p.id })),
  { path: null, file: "404.html" },
];

export interface RenderInput {
  readonly env: string;
  readonly page: SitePage;
  readonly css: readonly string[];
  readonly js: string;
}

export function renderPage({ env, page, css, js }: RenderInput): string {
  if (!isSiteEnv(env)) throw new Error(`INHERITFI_ENV must be mainnet (got ${env})`);
  const config = siteConfig(env);
  const params = protocolParams(env);
  setLocale("en");
  setSiteLocale("en");
  let assets: PageAssets = { css, js };
  let title: string;
  let description = st("site.description");
  let body;
  if (page.path === "/") {
    title = st("site.title");
    body = <Home config={config} params={params} />;
  } else if (page.path === "/disclaimer/") {
    title = `${st("disclaimer.title")} | INHERITFI`;
    body = <Disclaimer />;
  } else if (page.doc !== undefined) {
    const ref = DOC_PAGES.find((p) => p.id === page.doc);
    if (ref === undefined) throw new Error(`Unknown docs page ${page.doc}`);
    const d = docsData(config, params);
    title = `${ref.title} | INHERITFI Docs`;
    description = leadOf(page.doc, d);
    assets = { ...assets, before: [`/${DOCS_INDEX_FILE}`] };
    body = <DocsPage id={page.doc} d={d} />;
  } else {
    title = `${st("notFound.title")} | INHERITFI`;
    description = st("notFound.body");
    body = <NotFound />;
  }
  const html = renderToStaticMarkup(
    <Layout config={config} assets={assets} path={page.path} title={title} description={description} year={COPYRIGHT_YEAR}>
      {body}
    </Layout>,
  );
  return `<!doctype html>\n${html}\n`;
}

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/\s+/g, " ")
    .trim();

/** Description of a documentation page: its first highlighted paragraph (or the first one); without paragraphs (the glossary), the site's. */
function leadOf(id: string, d: ReturnType<typeof docsData>): string {
  const { Page } = docModule(id);
  const html = renderToStaticMarkup(<Page d={d} />);
  const m = /<p class="lead">([\s\S]*?)<\/p>/.exec(html) ?? /<p>([\s\S]*?)<\/p>/.exec(html);
  return m?.[1] === undefined ? st("site.description") : textOf(m[1]);
}

export interface DocsIndexEntry {
  /** Address (page and section). */
  readonly u: string;
  /** Title of the page. */
  readonly t: string;
  /** Title of the section (or of the page, for its introduction). */
  readonly h: string;
  /** Text of the section. */
  readonly x: string;
}

/** Search index: one entry per page and section, with its text . */
export function docsSearchIndex(env: string): DocsIndexEntry[] {
  if (!isSiteEnv(env)) throw new Error(`Unknown env ${env}`);
  setLocale("en");
  setSiteLocale("en");
  const d = docsData(siteConfig(env), protocolParams(env));
  const out: DocsIndexEntry[] = [];
  for (const ref of DOC_PAGES) {
    const { Page } = docModule(ref.id);
    const html = renderToStaticMarkup(<Page d={d} />);
    const parts = html.split(/(<h2 id="[^"]+">[\s\S]*?<\/h2>)/);
    let sec = "";
    let head = ref.title;
    let buf = parts[0] ?? "";
    const push = () => {
      const x = textOf(buf);
      if (x !== "") out.push({ u: sec === "" ? ref.path : `${ref.path}#${sec}`, t: ref.title, h: head, x });
    };
    for (const part of parts.slice(1)) {
      const m = /^<h2 id="([^"]+)">([\s\S]*?)<\/h2>$/.exec(part);
      if (m?.[1] !== undefined && m[2] !== undefined) {
        push();
        sec = m[1];
        head = textOf(m[2].replace(/<a class="anchor"[^>]*>#<\/a>/, ""));
        buf = "";
      } else {
        buf += part;
      }
    }
    push();
  }
  return out;
}
