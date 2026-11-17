import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../src/i18n/en.json";
import { setLocale } from "../../src/i18n/index";
import { OFFICIAL_SOCIAL } from "../../src/lib/links";
import { siteConfig } from "../config";
import { PERIOD_RANGES_DAYS, protocolParams } from "../params";
import { docsSearchIndex, PAGES, renderPage } from "../render";
import { days, docsData, networkName, wholeDays } from "./data";
import { CORE_LICENSE, INTERFACE_LICENSE, parseLicense } from "./license";
import { DOC_PAGES, DOCS_OUTLINE, docPath } from "./outline";
import { DOC_MODULES } from "./registry";

setLocale("en");
const d = docsData(siteConfig("mainnet"), protocolParams("mainnet"));
const body = (id: string) => {
  const m = DOC_MODULES[id];
  if (m === undefined) throw new Error(id);
  return renderToStaticMarkup(<m.Page d={d} />);
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** All the texts of the app catalog (for plurals, each variant). */
const APP_TEXTS: string[] = Object.values(en).flatMap((v) => (typeof v.text === "string" ? [v.text] : Object.values(v.text)));

describe("documentation", () => {
  it("table of contents: 27 pages in 4 sections, each one with its module and a unique address under /docs/", () => {
    expect(DOCS_OUTLINE.map((s) => s.title)).toEqual(["Welcome", "Technical Whitepaper", "User Guides", "Developers"]);
    expect(DOC_PAGES).toHaveLength(27);
    expect(Object.keys(DOC_MODULES).sort()).toEqual(DOC_PAGES.map((p) => p.id).sort());
    expect(new Set(DOC_PAGES.map((p) => p.path)).size).toBe(27);
    for (const p of DOC_PAGES) expect(p.path).toMatch(/^\/docs\/([a-z0-9-]+\/)*$/);
    expect(docPath("welcome")).toBe("/docs/");
    expect(() => docPath("decen-roadmap")).toThrow();
    // each page of the table of contents is generated as a page of the site
    expect(PAGES.filter((p) => p.doc !== undefined).map((p) => p.file)).toEqual(DOC_PAGES.map((p) => `${p.path.slice(1)}index.html`));
  });

  it("each page: \"On this page\" = its sections, in order; no em dashes; internal links to pages that exist", () => {
    const paths = new Set(PAGES.flatMap((p) => (p.path === null ? [] : [p.path])));
    for (const p of DOC_PAGES) {
      const html = body(p.id);
      const un = (s: string) => s.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
      const h2 = [...html.matchAll(/<h2 id="([^"]+)"><a class="anchor" href="#([^"]+)"[^>]*>#<\/a>([^<]*)<\/h2>/g)].map((m) => [m[1], un(m[3] ?? "")]);
      expect(h2, p.id).toEqual(DOC_MODULES[p.id]?.toc.map(([i, t]) => [i, t]));
      expect(html, p.id).not.toContain("\u2014");
      for (const m of html.matchAll(/href="([^"]+)"/g)) {
        const href = m[1] ?? "";
        if (href.startsWith("#")) expect(html, `${p.id} ${href}`).toContain(`id="${href.slice(1)}"`);
        else if (href.startsWith("/")) expect(paths.has(href.split("#")[0] ?? ""), `${p.id} ${href}`).toBe(true);
        else expect(Object.values(OFFICIAL_SOCIAL), `${p.id} ${href}`).toContain(href);
      }
    }
  });

  it("the names of buttons and app texts that the documentation quotes are those of the app catalog", () => {
    const pattern = (t: string) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{[a-zA-Z]+\\\}/g, ".+")}$`);
    let n = 0;
    for (const p of DOC_PAGES) {
      for (const m of body(p.id).matchAll(/<i>([^<]+)<\/i>/g)) {
        const label = (m[1] ?? "").replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
        const known = APP_TEXTS.includes(label) || APP_TEXTS.some((t) => t.includes("{") && pattern(t).test(label));
        expect(known, `${p.id}: "${label}" is not a text of the app`).toBe(true);
        n++;
      }
    }
    expect(n).toBeGreaterThan(50);
  });

  it("data: periods and fees of the site, contract ranges, network and contracts of the manifest", () => {
    expect(days(15n * 86_400n)).toBe("15 days");
    expect(days(86_400n)).toBe("1 day");
    expect(() => wholeDays(86_400n + 3_600n)).toThrow("not a whole number of days");
    expect(networkName(1)).toBe("Ethereum");
    expect(() => networkName(31337)).toThrow();
    expect(() => networkName(11155111)).toThrow();
    expect(d.fee).toBe("0.3%");
    expect(d.maxFee).toBe("0.3%");
    expect(d.ranges.recoveryInactivityPeriod).toBe("14 to 180 days");
    expect(d.ranges.inheritInactivityPeriod).toBe("21 to 180 days");
    expect(Object.keys(d.ranges)).toEqual(Object.keys(PERIOD_RANGES_DAYS));
    const gov = text(body("wp-governance"));
    for (const r of Object.values(d.ranges)) expect(gov).toContain(r);
    const c = body("contracts");
    for (const a of d.assets) expect(c).toContain(a.address);
    for (const l of d.libraries) expect(c).toContain(l.address);
    expect(c).toContain(d.manifestSha256);
    expect(c).toContain(`${d.network}, chain ID ${String(d.chainId)}`);
    expect(text(body("links"))).toContain("app.inheritfi.com");
  });

  it("licenses: the interface one is read from LICENSE.txt; the contracts one only differs in the name and the two ENS names", () => {
    expect(INTERFACE_LICENSE.first).toBe("Business Source License 1.1");
    expect(INTERFACE_LICENSE.work).toBe("INHERITFI V1 Interface");
    expect(INTERFACE_LICENSE.date).toBe("2030-11-10");
    expect(INTERFACE_LICENSE.change).toBe("GNU General Public License v3.0 or later");
    const swap = (s: string) => s.replace("V1 Interface", "V1 Core").replace("v1-interface-", "v1-core-");
    expect(CORE_LICENSE).toEqual({ ...INTERFACE_LICENSE, work: swap(INTERFACE_LICENSE.work), grant: swap(INTERFACE_LICENSE.grant), dateEns: swap(INTERFACE_LICENSE.dateEns) });
    expect(() => parseLicense("Business Source License 1.1\nLicensor: x\n")).toThrow("not found");
    const lic = text(body("license"));
    expect(lic).toContain("The earlier of 2030-11-10 or a date specified at v1-core-license-date.inheritfi.eth");
    expect(lic).toContain("The earlier of 2030-11-10 or a date specified at v1-interface-license-date.inheritfi.eth");
  });

  it("search: one entry per page and section, all to /docs/ addresses that exist, no em dashes", () => {
    const idx = docsSearchIndex("mainnet");
    expect(idx.length).toBeGreaterThan(100);
    const paths = new Set(DOC_PAGES.map((p) => p.path));
    for (const e of idx) {
      expect(paths.has(e.u.split("#")[0] ?? ""), e.u).toBe(true);
      expect(JSON.stringify(e)).not.toContain("\u2014");
    }
    expect(new Set(idx.map((e) => e.u.split("#")[0])).size).toBe(27);
    const fees = idx.find((e) => e.u === "/docs/whitepaper/fees/#cap");
    expect(fees?.h).toBe("Capped in the code");
  });

  it("full page: title, description and menu; the Docs option is only marked on /docs/", () => {
    const html = (path: string) => {
      const p = PAGES.find((x) => x.path === path);
      if (p === undefined) throw new Error(path);
      return renderPage({ env: "mainnet", page: p, css: ["/a.css"], js: "/a.js" });
    };
    const lic = html("/docs/developers/license/");
    expect(lic).toContain("<title>License | INHERITFI Docs</title>");
    expect(lic).toContain('<meta name="description" content="Both parts of INHERITFI V1, the smart contracts and the interface, are licensed under the Business Source License 1.1 (BUSL 1.1)."/>');
    expect(lic).toContain('<a href="/docs/developers/license/" aria-current="page">License</a>');
    expect([...lic.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    expect(html("/docs/")).toContain('<a class="menu__item" href="/docs/" aria-current="page">');
    expect(html("/docs/guides/glossary/")).toContain('<meta name="description" content="');
  });
});
