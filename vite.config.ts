import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { appLinks } from "./src/lib/links";
import { rpcUrlFor } from "./src/web3/endpoints";

// INHERITFI: the environment (and therefore the manifest) is chosen at build time with INHERITFI_ENV; only that one goes into the bundle.
const ENVS = ["mainnet"] as const;
const requested = process.env.INHERITFI_ENV ?? "mainnet";
const env = ENVS.find((e) => e === requested);
if (env === undefined) {
  throw new Error(`INHERITFI_ENV must be one of ${ENVS.join(", ")} (got ${requested})`);
}
// Menu links and RPC node of this environment only (the bundle never receives those of the others).
// On mainnet the build fails while the real official links are missing.
const links = appLinks(env);
const rpcUrl = rpcUrlFor(env);
const deploymentModule = fileURLToPath(new URL(`./src/contracts/generated/${env}.ts`, import.meta.url));
if (!existsSync(deploymentModule)) {
  throw new Error(`Missing ${deploymentModule}; run node scripts/generate-contracts.mjs`);
}

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@deployment": deploymentModule } },
  define: { __INHERITFI_APP_LINKS__: JSON.stringify(links), __INHERITFI_RPC_URL__: JSON.stringify(rpcUrl) },
  // assetsInlineLimit 0: fonts and logos are files of our own domain, never data: (the app CSP has font-src 'self').
  build: { sourcemap: false, assetsInlineLimit: 0 },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "site/**/*.test.ts", "site/**/*.test.tsx", "scripts/**/*.test.mjs"],
    environment: "node",
    passWithNoTests: false,
  },
});
