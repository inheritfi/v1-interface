// INHERITFI: common HTML document of the site. Everything is static: no cookies, no analytics, no third-party requests.
// The security policy (CSP) forbids inline scripts and styles; the VPS server must also send the same
// policy and frame-ancestors 'none' as HTTP headers (frame-ancestors does not work in <meta>).

import type { ReactNode } from "react";
import { LOCALES } from "../../src/i18n/locales";
import { siteLocale, st } from "../i18n";
import { Mark, Wordmark } from "../components/Mark";
import { Sprite, Use } from "../components/Sprite";
import { socialOf, type SiteConfig } from "../config";

/** Home page of the documentation (site/docs/outline.ts). */
export const DOCS_PATH = "/docs/";

/**
 * Links to external sites (X, Discord, GitHub): always in a new tab, so as not to take the user away from the site
 * (the app does the same). noopener: the opened page cannot control ours.
 */
export const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export interface PageAssets {
  readonly css: readonly string[];
  readonly js: string;
  /** Data files loaded before the client script (the documentation search index). */
  readonly before?: readonly string[];
}

export interface PageProps {
  readonly config: SiteConfig;
  readonly assets: PageAssets;
  /** Public path of the page (e.g. "/" or "/disclaimer/"); null for the error page, which has no address of its own. */
  readonly path: string | null;
  readonly title: string;
  readonly description: string;
  readonly year: number;
  readonly children: ReactNode;
}

export function Layout({ config, assets, path, title, description, year, children }: PageProps) {
  const lang = siteLocale();
  /** In the menu, the option of the current page: choosing it only closes the menu (site/client/main.ts). */
  const here = (href: string) => (path === href ? ("page" as const) : undefined);
  const social = socialOf(config);
  const out = EXTERNAL;
  return (
    <html lang={lang} dir={LOCALES[lang].dir}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        <meta name="referrer" content="no-referrer" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#05060b" />
        <title>{title}</title>
        <meta name="description" content={description} />
        {path !== null && <link rel="canonical" href={`${config.origin}${path}`} />}
        {path === null && <meta name="robots" content="noindex" />}
        {/* PNG first (as Uniswap does): the in-app browsers of mobile wallets ignore the SVG and some cannot draw an ICO.
            favicon.ico stays as a file for browsers that request /favicon.ico on their own. */}
        <link rel="shortcut icon" type="image/png" href="/favicon.png" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {assets.css.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {(assets.before ?? []).map((src) => (
          <script key={src} src={src} defer />
        ))}
        <script type="module" src={assets.js} />
      </head>
      <body>
        <a className="skip" href="#main">
          {st("site.skip")}
        </a>
        <Sprite />
        <div className="bg" aria-hidden="true">
          <div className="bg__blob bg__blob--a" />
          <div className="bg__blob bg__blob--b" />
          <div className="bg__blob bg__blob--c" />
          <div className="bg__grid" />
          <div className="bg__spot" />
        </div>
        <header className="top">
          <div className="wrap top__inner">
            <a className="brand" href="/" aria-label={st("nav.home")}>
              <Mark className="brand__icon" />
              <Wordmark />
            </a>
            <div className="top__right">
              <a className="btn btn--primary btn--small btn--launch" href={config.appUrl}>
                {st("nav.launch")}
              </a>
              <button className="menu-btn" type="button" aria-expanded="false" aria-controls="menu" aria-label={st("menu.button")}>
                <span />
                <span />
                <span />
              </button>
              <nav className="menu" id="menu" aria-label={st("menu.button")}>
                <div className="menu__label">{st("menu.protocol")}</div>
                <a className="menu__item menu__item--app" href={config.appUrl}>
                  <span className="menu__icon">
                    <Use name="app" />
                  </span>
                  <span className="menu__text">
                    <span className="menu__title">{st("menu.app")}</span>
                    <span className="menu__desc">{st("menu.appDesc")}</span>
                  </span>
                  <Use name="arrow" className="menu__arrow" size={18} />
                </a>
                <a className="menu__item" href={DOCS_PATH} aria-current={here(DOCS_PATH)}>
                  <span className="menu__icon">
                    <Use name="docs" />
                  </span>
                  <span className="menu__text">
                    <span className="menu__title">{st("menu.docs")}</span>
                    <span className="menu__desc">{st("menu.docsDesc")}</span>
                  </span>
                  <Use name="arrow" className="menu__arrow" size={18} />
                </a>
                <a className="menu__item" href="/disclaimer/" aria-current={here("/disclaimer/")}>
                  <span className="menu__icon">
                    <Use name="doc-alert" />
                  </span>
                  <span className="menu__text">
                    <span className="menu__title">{st("menu.disclaimer")}</span>
                    <span className="menu__desc">{st("menu.disclaimerDesc")}</span>
                  </span>
                  <Use name="arrow" className="menu__arrow" size={18} />
                </a>
                <div className="menu__sep" />
                <div className="menu__label">{st("menu.social")}</div>
                <div className="menu__social">
                  <a href={social.x} {...out}>
                    <Use name="x" />X
                  </a>
                  <a href={social.discord} {...out}>
                    <Use name="discord" />
                    Discord
                  </a>
                  <a href={social.github} {...out}>
                    <Use name="github" />
                    GitHub
                  </a>
                </div>
                <div className="menu__foot">{st("menu.trust")}</div>
              </nav>
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="foot">
          <div className="foot__inner">
            <div>
              <a className="brand" href="/" aria-label={st("nav.home")}>
                <Mark className="brand__icon" />
                <Wordmark />
              </a>
              <p className="foot__tag">{st("footer.tag")}</p>
            </div>
            <div>
              <h4>{st("footer.protocol")}</h4>
              <ul>
                <li>
                  <a href={config.appUrl}>{st("footer.app")}</a>
                </li>
                <li>
                  <a href={DOCS_PATH}>{st("footer.docs")}</a>
                </li>
                <li>
                  <a href="/disclaimer/">{st("footer.disclaimer")}</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>{st("footer.social")}</h4>
              <div className="social">
                <a href={social.x} aria-label={st("footer.x")} {...out}>
                  <Use name="x" />
                </a>
                <a href={social.discord} aria-label={st("footer.discord")} {...out}>
                  <Use name="discord" />
                </a>
                <a href={social.github} aria-label={st("footer.github")} {...out}>
                  <Use name="github" />
                </a>
              </div>
            </div>
          </div>
          <div className="foot__base">
            <span>{st("footer.copyright", { year })}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
