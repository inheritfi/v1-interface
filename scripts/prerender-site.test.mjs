// @ts-check
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkSite, fileFor, indexProblems, inlineProblems, links, networkProblems, SiteError } from "./prerender-site.mjs";

/** @type {string[]} */
const temps = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

const ORIGIN = "https://inheritfi.com";
const ALLOWED = ["https://app.inheritfi.com/", "https://x.com/"];

/** Folder with index.html, disclaimer/index.html and a resource. */
function site() {
  const d = mkdtempSync(join(tmpdir(), "inheritfi-site-"));
  temps.push(d);
  mkdirSync(join(d, "disclaimer"));
  mkdirSync(join(d, "assets"));
  writeFileSync(join(d, "index.html"), "x");
  writeFileSync(join(d, "disclaimer", "index.html"), "x");
  writeFileSync(join(d, "assets", "a.css"), "x");
  return d;
}

describe("prerender-site", () => {
  it("internal paths → files; invalid paths fail", () => {
    expect(fileFor("/")).toBe("index.html");
    expect(fileFor("/disclaimer/")).toBe("disclaimer/index.html");
    expect(fileFor("/disclaimer/#risks")).toBe("disclaimer/index.html");
    expect(fileFor("/assets/a.css")).toBe("assets/a.css");
    expect(() => fileFor("//evil.example/")).toThrow(SiteError);
    expect(() => fileFor("x")).toThrow(SiteError);
  });

  it("detects inline scripts and styles, event handlers and javascript:", () => {
    expect(inlineProblems('<script type="module" src="/a.js"></script>')).toEqual([]);
    expect(inlineProblems("<script>alert(1)</script>")).toEqual(["<script> without src", "<script> with content"]);
    expect(inlineProblems('<p style="color:red">x</p>')).toEqual(["inline style attribute"]);
    expect(inlineProblems("<style>p{}</style>")).toEqual(["<style> element"]);
    expect(inlineProblems('<a onclick="x()">x</a>')).toEqual(["inline event handler"]);
    expect(inlineProblems('<a href="javascript:x()">x</a>')).toEqual(["javascript: link"]);
  });

  it("links: internal ones that exist, anchors, canonical of the own origin and only the allowed external ones", () => {
    const d = site();
    const ok = `<link rel="canonical" href="${ORIGIN}/"/><a href="/disclaimer/">d</a><a href="#how">h</a><section id="how"></section><a href="https://x.com/">x</a><link href="/assets/a.css"/>`;
    expect(links(ok)).toHaveLength(5);
    expect(checkSite(d, [{ file: "index.html", html: ok }], ALLOWED, ORIGIN)).toEqual([]);
    const bad = '<a href="/docs/">d</a><a href="#none">n</a><a href="https://evil.example/">e</a><a href="mailto:a@b.c">m</a><img src="//cdn.example/x.png"/>';
    expect(checkSite(d, [{ file: "index.html", html: bad }], ALLOWED, ORIGIN)).toEqual([
      "index.html: broken link /docs/",
      "index.html: missing anchor #none",
      "index.html: external link not allowed https://evil.example/",
      "index.html: link not allowed mailto:a@b.c",
      "index.html: link not allowed //cdn.example/x.png",
    ]);
  });

  it("pending pages: only those in the list are accepted without existing; one with an anchor still fails", () => {
    const d = site();
    const html = '<a href="/docs/">d</a><a href="/docs/#x">dx</a><a href="/other/">o</a>';
    expect(checkSite(d, [{ file: "index.html", html }], ALLOWED, ORIGIN, ["/docs/"])).toEqual(["index.html: broken link /docs/#x", "index.html: broken link /other/"]);
    expect(checkSite(d, [{ file: "index.html", html: '<a href="/docs/">d</a>' }], ALLOWED, ORIGIN)).toEqual(["index.html: broken link /docs/"]);
  });

  it("the JS and the CSS cannot have addresses, network functions or data: resources", () => {
    expect(networkProblems("const a=1;document.querySelector('x')")).toEqual([]);
    expect(networkProblems("fetch('/x')")).toEqual(["fetch("]);
    expect(networkProblems("new WebSocket(u)")).toEqual(["WebSocket"]);
    expect(networkProblems("@font-face{src:url(https://fonts.example/a.woff2)}")).toEqual(["http(s) address"]);
    expect(networkProblems('@font-face{src:url("data:font/woff2;base64,AAAA")}')).toEqual(["embedded data: resource (the CSP blocks it)"]);
    expect(networkProblems("@font-face{src:url(/assets/a.woff2)}")).toEqual([]);
  });

  it("the documentation search index is only data: prefix + JSON list of /docs/ entries", () => {
    const P = "window.INHERITFI_DOCS_INDEX = ";
    const e = { u: "/docs/whitepaper/fees/#cap", t: "Fees", h: "Capped in the code", x: "The 0.3% cap" };
    expect(indexProblems(`${P}${JSON.stringify([e])};\n`, P)).toEqual([]);
    expect(indexProblems(`${P}${JSON.stringify([e])};alert(1);\n`, P)).toEqual(["the index is not JSON"]);
    expect(indexProblems(`fetch("/x");${P}[];\n`, P)).toEqual(["the index does not have the form prefix + JSON + ;"]);
    expect(indexProblems(`${P}[];\n`, P)).toEqual(["the index is not a list with entries"]);
    expect(indexProblems(`${P}${JSON.stringify([{ ...e, u: "https://evil.example/" }])};\n`, P)).toHaveLength(1);
    expect(indexProblems(`${P}${JSON.stringify([{ ...e, extra: 1 }])};\n`, P)).toHaveLength(1);
  });
});
