// INHERITFI: configuration of the public site (landing at inheritfi.com, documentation at inheritfi.com/docs; the app at
// app.inheritfi.com). The environment is chosen at build time with
// INHERITFI_ENV, the same as the app.

import { OFFICIAL_SOCIAL } from "../src/lib/links";

/** Year of the copyright notice in the footer (fixed, so that the build is reproducible). */
export const COPYRIGHT_YEAR = 2026;

export const SITE_ENVS = ["mainnet"] as const;
export type SiteEnv = (typeof SITE_ENVS)[number];

export interface SocialLinks {
  readonly x: string;
  readonly discord: string;
  readonly github: string;
}

export interface SiteConfig {
  readonly env: SiteEnv;
  /** Origin of the site, without trailing slash (canonical links and sitemap). */
  readonly origin: string;
  /** Full address of the app. */
  readonly appUrl: string;
  /**
   * Official accounts: the same as the app (OFFICIAL_SOCIAL in src/lib/links.ts) in every environment (single source). If they were null or the placeholder home pages, the mainnet build fails.
   */
  readonly social: SocialLinks | null;
}

/**
 * Linked pages that do not exist yet: the site's link check accepts them
 * only if they are in this list. The mainnet build fails while any remains.
 */
export const PENDING_PAGES: readonly string[] = [];

/** Home pages of each network, used before as placeholders: mainnet always rejects them. */
export const PLACEHOLDER_SOCIAL: SocialLinks = { x: "https://x.com/", discord: "https://discord.com/", github: "https://github.com/" };

const CONFIGS: Readonly<Record<SiteEnv, Omit<SiteConfig, "env">>> = {
  mainnet: {
    origin: "https://inheritfi.com",
    appUrl: "https://app.inheritfi.com/",
    social: OFFICIAL_SOCIAL,
  },
};

export function isSiteEnv(value: string): value is SiteEnv {
  return (SITE_ENVS as readonly string[]).includes(value);
}

/** Configuration of an environment. On mainnet it requires the official accounts (never the placeholder home pages). */
export function siteConfig(env: SiteEnv): SiteConfig {
  const c = { env, ...CONFIGS[env] };
  if (c.social === null) throw new Error("mainnet: set the official social links in site/config.ts before building");
  if (c.social.x === PLACEHOLDER_SOCIAL.x || c.social.discord === PLACEHOLDER_SOCIAL.discord || c.social.github === PLACEHOLDER_SOCIAL.github) {
    throw new Error("mainnet: the social links are still the placeholder home pages");
  }
  if (c.social.x !== OFFICIAL_SOCIAL.x || c.social.discord !== OFFICIAL_SOCIAL.discord || c.social.github !== OFFICIAL_SOCIAL.github) {
    throw new Error("mainnet: the social links are not the official accounts");
  }
  if (PENDING_PAGES.length > 0) throw new Error(`mainnet: pages still pending: ${PENDING_PAGES.join(", ")}`);
  return c;
}

/** Official production domains, without protocol (the documentation shows them in every environment). */
export function productionHosts(): { readonly site: string; readonly app: string } {
  const m = CONFIGS.mainnet;
  return { site: new URL(m.origin).host, app: new URL(m.appUrl).host };
}

/** The configuration the pages need: the social links already checked. */
export function socialOf(c: SiteConfig): SocialLinks {
  if (c.social === null) throw new Error(`${c.env}: social links not set`);
  return c.social;
}
