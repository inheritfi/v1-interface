// INHERITFI: links of the app menu (public site and official networks). The official accounts (X, Discord and GitHub)
// are the same in every environment and the site uses them too (site/config.ts).
// The site: https://inheritfi.com. vite.config.ts calls appLinks at build time and writes the result into the bundle.

export type AppEnv = "mainnet";

export interface AppLinks {
  readonly site: string;
  readonly x: string;
  readonly discord: string;
  readonly github: string;
}

/** Official INHERITFI accounts. Single source for the app and the site. */
export const OFFICIAL_SOCIAL: Omit<AppLinks, "site"> = {
  x: "https://x.com/inheritfi",
  discord: "https://discord.inheritfi.com",
  github: "https://github.com/inheritfi",
};

/** Home pages of each network, used before as placeholders: mainnet always rejects them. */
export const PLACEHOLDER_LINKS: Omit<AppLinks, "site"> = {
  x: "https://x.com/",
  discord: "https://discord.com/",
  github: "https://github.com/",
};

export const LINKS: Readonly<Record<AppEnv, AppLinks | null>> = {
  mainnet: { site: "https://inheritfi.com", ...OFFICIAL_SOCIAL },
};

/** Links of an environment. On mainnet it requires the official accounts (never the placeholder home pages). */
export function appLinks(env: AppEnv, table: Readonly<Record<AppEnv, AppLinks | null>> = LINKS): AppLinks {
  const l = table[env];
  if (l === null) throw new Error(`${env}: set the official links in src/lib/links.ts before building`);
  for (const k of ["x", "discord", "github"] as const) {
    if (l[k] === PLACEHOLDER_LINKS[k]) throw new Error(`mainnet: the ${k} link is still the placeholder home page`);
    if (l[k] !== OFFICIAL_SOCIAL[k]) throw new Error(`mainnet: the ${k} link is not the official account`);
  }
  if (!l.site.startsWith("https://")) throw new Error("mainnet: the site link must use https");
  return l;
}
