import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deployment } from "@deployment";
import { BrandIcon } from "../src/components/Brand";
import { Sprite } from "./components/Sprite";
import { OFFICIAL_SOCIAL, PLACEHOLDER_LINKS, appLinks } from "../src/lib/links";
import { PENDING_PAGES, PLACEHOLDER_SOCIAL, SITE_ENVS, siteConfig } from "./config";
import { formatFee, protocolParams } from "./params";
import { longDate } from "./pages/Disclaimer";
import { tickerOrder } from "./pages/Home";
import { allowedExternal, CSP, PAGES, pendingPages, renderPage } from "./render";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const page = (path: string | null) => {
  const p = PAGES.find((x) => x.path === path);
  if (p === undefined) throw new Error(`no page ${String(path)}`);
  return renderPage({ env: "mainnet", page: p, css: ["/assets/site.css"], js: "/assets/site.js" });
};
/** Approximate visible text: without tags or repeated spaces, with the React entities undone. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ");
/** Shapes, colors and gradients of an SVG, in order. */
const shapes = (s: string) =>
  [...s.matchAll(/\s(?:points|d|cx|cy|r|x1|y1|x2|y2|fill|stroke|stroke-width|opacity|offset|stop-color|transform|gradientTransform|href|stroke-dasharray)="([^"]*)"/g)].map((m) => m[1]);

/** Asset ribbon of the authorized landing (308d557c…), in its order. */
const APPROVED_TICKERS = ["ETH", "AAVE", "AXS", "COMP", "CRV", "crvUSD", "CVX", "DAI", "ENS", "ETHFI", "FET", "GHO", "GRT", "IMX", "INJ", "JASMY", "LDO", "LINK", "PENDLE", "PEPE", "POL", "SHIB", "SKY", "STRK", "UNI", "WBTC", "WETH", "WLD", "wstETH"];

describe("public site", () => {
  it("icon: the site symbols are the pieces of the app and the favicons of the app and of the site are the same file", () => {
    const sprite = renderToStaticMarkup(<Sprite />);
    const app = renderToStaticMarkup(<BrandIcon className="x" />);
    const symbol = (id: string) => {
      const m = new RegExp(`<symbol id="${id}" viewBox="0 0 312 360">([\\s\\S]*?)</symbol>`).exec(sprite);
      if (m?.[1] === undefined) throw new Error(`missing symbol ${id}`);
      return m[1];
    };
    // base + icon of the site = icon of the app (without the gradients, which the site defines once in the sheet)
    expect(shapes(symbol("brand-base") + symbol("brand-icon"))).toEqual(shapes(app.slice(app.indexOf("</defs>"))));
    const favApp = readFileSync(join(ROOT, "public", "favicon.svg"), "utf8");
    const favSite = readFileSync(join(ROOT, "site", "public", "favicon.svg"), "utf8");
    expect(favSite).toBe(favApp);
    // The PNG and ICO versions (made from favicon.svg for mobile wallet browsers) are also the same file in both.
    for (const f of ["favicon.png", "favicon.ico", "apple-touch-icon.png"]) {
      expect(readFileSync(join(ROOT, "site", "public", f)).equals(readFileSync(join(ROOT, "public", f))), f).toBe(true);
    }
    expect(shapes(app).length).toBeGreaterThan(60);
    expect(shapes(favApp)).toEqual(shapes(app));
  });

  it("the pages have no inline scripts or styles, carry the CSP and load the site script", () => {
    for (const p of PAGES) {
      const html = renderPage({ env: "mainnet", page: p, css: ["/a.css"], js: "/a.js" });
      expect(html.startsWith("<!doctype html>\n<html lang=\"en\" dir=\"ltr\">")).toBe(true);
      expect(html).not.toMatch(/\sstyle="|<style|\son[a-z]+="/i);
      expect(html).toContain(`content="${CSP.replaceAll("'", "&#x27;")}"`);
      expect(html).toContain('<script type="module" src="/a.js"></script>');
      // the documentation also loads its search index (data file, before the site script)
      if (p.doc === undefined) expect([...html.matchAll(/<script\b/g)]).toHaveLength(1);
      else {
        expect([...html.matchAll(/<script\b/g)]).toHaveLength(2);
        expect(html.indexOf('<script src="/docs/search-index.js" defer=""></script>')).toBeGreaterThan(0);
        expect(html.indexOf('<script src="/docs/search-index.js"')).toBeLessThan(html.indexOf('<script type="module"'));
      }
    }
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).toContain("connect-src 'none'");
  });

  it("home page: the assets of the manifest in the ribbon (order of the authorized landing, twice) and the protocol figures", () => {
    expect(deployment.assets).toHaveLength(29);
    const order = tickerOrder(deployment.assets.map((a) => a.ticker));
    expect(order).toEqual(APPROVED_TICKERS);
    const html = page("/");
    const chips = [...html.matchAll(/<span class="chip(?: chip--eth)?"( aria-hidden="true")?><i><\/i>([^<]+)<\/span>/g)];
    expect(chips.map((m) => m[2])).toEqual([...order, ...order]);
    expect(chips.map((m) => m[1] !== undefined)).toEqual([...order.map(() => false), ...order.map(() => true)]);
    const t = text(html);
    for (const s of [
      "Now supporting 29 assets.",
      "≤0.3% Protocol Fee",
      "29 Supported Assets",
      "Up to 30 heirs with custom percentage splits",
      "Every protocol fee is hard-capped at 0.3% by the contracts.",
      "29 Assets ETH plus 28 leading ERC-20s",
      "Deposit any of 29 supported assets.",
      "$2.822T Crypto Market Cap",
      "600M+ Crypto Users Globally",
      "100% On-Chain",
      "© 2026 INHERITFI · All rights reserved",
    ]) {
      expect(t).toContain(s);
    }
    expect(t).not.toContain("Trustless ");
    // each animated figure ends at the same value that is seen without JavaScript
    for (const m of html.matchAll(/<div class="stat__v" data-count="([^"]+)"(?: data-pre="([^"]*)")?(?: data-suf="([^"]*)")?(?: data-dec="([^"]*)")?>([^<]+)<\/div>/g)) {
      const [, c = "", pre = "", suf = "", dec = "0", shown] = m;
      expect(pre + parseFloat(c).toFixed(Number(dec)) + suf).toBe(shown);
    }
    expect([...html.matchAll(/class="stat__v"/g)]).toHaveLength(5);
  });

  it("links: the app, /docs/, the disclaimer and the official X, Discord and GitHub accounts; mainnet builds with the deployed values", () => {
    const html = page("/");
    expect(html).toContain('href="https://app.inheritfi.com/"');
    expect(html).toContain('href="/docs/"');
    expect(html).toContain('href="/disclaimer/"');
    // the networks, on every page and in every place (menu, footer, home page), always in a new tab
    const socials = [OFFICIAL_SOCIAL.x, OFFICIAL_SOCIAL.discord, OFFICIAL_SOCIAL.github];
    for (const p of PAGES) {
      const h = page(p.path);
      const anchors = [...h.matchAll(/<a\s[^>]*>/g)].map((m) => m[0]).filter((a) => socials.some((u) => a.includes(`href="${u}"`)));
      // 6 in the menu and the footer; the home page and Official Links & Social add their own
      expect(anchors.length, String(p.path)).toBe(p.path === "/" ? 7 : p.path === "/docs/official-links/" ? 9 : 6);
      for (const a of anchors) expect(a, a).toMatch(/ target="_blank" rel="noopener noreferrer"/);
    }
    // the own links (app, documentation, disclaimer, home page) open in the same tab
    for (const a of [...html.matchAll(/<a\s[^>]*>/g)].map((m) => m[0]).filter((x) => !socials.some((u) => x.includes(`href="${u}"`)))) expect(a, a).not.toContain("target=");
    expect(allowedExternal("mainnet")).toEqual(["https://app.inheritfi.com/", "https://x.com/inheritfi", "https://discord.inheritfi.com", "https://github.com/inheritfi"]);
    // no page links to the placeholder home pages anymore
    for (const p of PAGES) for (const u of [PLACEHOLDER_SOCIAL.x, PLACEHOLDER_SOCIAL.discord, PLACEHOLDER_SOCIAL.github]) expect(page(p.path), String(p.path)).not.toContain(`href="${u}"`);
    expect(PENDING_PAGES).toEqual([]);
    expect(pendingPages("mainnet")).toEqual([]);
    expect(siteConfig("mainnet").social).toEqual(OFFICIAL_SOCIAL);
    expect(protocolParams("mainnet")).toEqual({ recoveryInactivityPeriod: 2_592_000n, inheritInactivityPeriod: 3_888_000n, inheritWaitingTime: 604_800n, inheritRemainingWaitingTime: 1_209_600n, recoveryWaitingTime: 604_800n, recoveryExecutionWindow: 2_592_000n, wrappingTax: 30n, unwrappingTax: 30n, inheritanceTax: 30n, recoveryTax: 30n, maxHeirs: 30n });
    // mainnet: the values read from the 29 deployed wrappers (2026-11-12, block 26,402,990); its pages link to the production app
    expect(renderPage({ env: "mainnet", page: { path: "/", file: "index.html" }, css: [], js: "/a.js" })).toContain('href="https://app.inheritfi.com/"');
    expect(() => renderPage({ env: "testnet", page: { path: "/", file: "index.html" }, css: [], js: "/a.js" })).toThrow("INHERITFI_ENV must be");
  });

  it("official accounts: the app and the site use the same three links in every environment", () => {
    expect(OFFICIAL_SOCIAL).toEqual({ x: "https://x.com/inheritfi", discord: "https://discord.inheritfi.com", github: "https://github.com/inheritfi" });
    for (const env of SITE_ENVS) {
      const { site, ...app } = appLinks(env);
      expect(app, env).toEqual(OFFICIAL_SOCIAL);
      expect(siteConfig(env).social, env).toEqual(OFFICIAL_SOCIAL);
      expect(site, env).toBe(siteConfig(env).origin);
    }
    expect(PLACEHOLDER_SOCIAL).toEqual(PLACEHOLDER_LINKS);
    // mainnet rejects the placeholder home pages and any account that is not the official one
    const withLinks = (x: string) => ({ mainnet: { site: "https://inheritfi.com", ...OFFICIAL_SOCIAL, x } });
    expect(() => appLinks("mainnet", withLinks(PLACEHOLDER_LINKS.x))).toThrow("mainnet: the x link is still the placeholder home page");
    expect(() => appLinks("mainnet", withLinks("https://x.com/other"))).toThrow("mainnet: the x link is not the official account");
  });

  it("disclaimer: 12 sections with their table of contents, date, fee cap and no draft mark; 404 without canonical and out of the index", () => {
    const html = page("/disclaimer/");
    const d = text(html);
    for (let i = 1; i <= 12; i++) {
      expect(html).toContain(`id="s${String(i)}"`);
      expect(html).toContain(`href="#s${String(i)}"`);
    }
    expect([...html.matchAll(/<section class="card clause"/g)]).toHaveLength(12);
    expect(d).toContain("Last updated October 16, 2026 · Please read carefully before using INHERITFI");
    expect(d).toContain("fee rates (never above 0.3%)");
    expect(d).toContain('INHERITFI (the "Protocol") is decentralized software');
    expect(d).not.toMatch(/draft|pending legal review/i);
    const nf = page(null);
    expect(nf).toContain('<meta name="robots" content="noindex"/>');
    expect(nf).not.toContain('rel="canonical"');
  });

  it("menu: the option of the current page is marked (choosing it only closes the menu); on the others, none", () => {
    const current = (h: string) => [...h.matchAll(/<a class="menu__item[^"]*" href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
    expect(current(page("/disclaimer/"))).toEqual(["/disclaimer/"]);
    expect(current(page("/"))).toEqual([]);
    expect(current(page(null))).toEqual([]);
    expect([...page("/disclaimer/").matchAll(/aria-current=/g)]).toHaveLength(1);
  });

  it("formats: fee as in the app and long date in English", () => {
    expect(formatFee(30n)).toBe("0.3%");
    expect(formatFee(25n)).toBe("0.25%");
    expect(formatFee(5n)).toBe("0.05%");
    expect(formatFee(100n)).toBe("1%");
    expect(formatFee(0n)).toBe("0%");
    expect(() => formatFee(-1n)).toThrow();
    expect(longDate("2026-10-16")).toBe("October 16, 2026");
    expect(longDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("the client script only imports the site style sheet (neither viem nor wagmi nor anything network-related)", () => {
    const dir = join(ROOT, "site", "client");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const m of src.matchAll(/^import\s.*?from\s+"([^"]+)";|^import\s+"([^"]+)";/gm)) {
        const spec = m[1] ?? m[2] ?? "";
        expect(spec.startsWith("./") || spec === "../styles/site.css", `${f}: ${spec}`).toBe(true);
      }
      expect(src).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie/);
    }
  });
});
