import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// INHERITFI: build of the public site (landing, documentation and legal pages), separate from the app.
// - Client step: site/client/main.ts (the only script) and site/styles/site.css with the fonts → dist-site/assets.
// - SSR step (--ssr): site/render.tsx → .site-ssr/render.js, which scripts/prerender-site.mjs uses to write the HTML.
// The site carries no viem, wagmi or anything that talks to the chain; the site test checks it.
// assetsInlineLimit 0: no font is embedded as data: (the site CSP, font-src 'self', would block them).
const ENVS = ["mainnet"] as const;
const requested = process.env.INHERITFI_ENV ?? "mainnet";
const env = ENVS.find((e) => e === requested);
if (env === undefined) {
  throw new Error(`INHERITFI_ENV must be one of ${ENVS.join(", ")} (got ${requested})`);
}
const deploymentModule = fileURLToPath(new URL(`./src/contracts/generated/${env}.ts`, import.meta.url));
if (!existsSync(deploymentModule)) {
  throw new Error(`Missing ${deploymentModule}; run node scripts/generate-contracts.mjs`);
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  resolve: { alias: { "@deployment": deploymentModule } },
  publicDir: isSsrBuild === true ? false : "site/public",
  preview: { port: 4174, strictPort: true },
  build: isSsrBuild === true
    ? { outDir: ".site-ssr", emptyOutDir: true, sourcemap: false, rolldownOptions: { input: "site/render.tsx" } }
    : { outDir: "dist-site", emptyOutDir: true, sourcemap: false, manifest: true, assetsInlineLimit: 0, rolldownOptions: { input: "site/client/main.ts" } },
}));
