// INHERITFI: registry of the documentation pages (one per entry of the table of contents; checked by the site test).
import type { ReactNode } from "react";
import type { DocsData } from "./data";
import * as P_welcome from "./pages/welcome";
import * as P_links from "./pages/links";
import * as P_wp_executive from "./pages/wp-executive";
import * as P_wp_problem from "./pages/wp-problem";
import * as P_wp_solution from "./pages/wp-solution";
import * as P_wp_inheritance from "./pages/wp-inheritance";
import * as P_wp_recovery from "./pages/wp-recovery";
import * as P_wp_fees from "./pages/wp-fees";
import * as P_wp_assets from "./pages/wp-assets";
import * as P_wp_features from "./pages/wp-features";
import * as P_wp_governance from "./pages/wp-governance";
import * as P_wp_security from "./pages/wp-security";
import * as P_wp_comparison from "./pages/wp-comparison";
import * as P_wp_market from "./pages/wp-market";
import * as P_wp_conclusion from "./pages/wp-conclusion";
import * as P_guide_wallet from "./pages/guide-wallet";
import * as P_guide_wrap from "./pages/guide-wrap";
import * as P_guide_heirs from "./pages/guide-heirs";
import * as P_guide_recovery from "./pages/guide-recovery";
import * as P_guide_active from "./pages/guide-active";
import * as P_guide_claim from "./pages/guide-claim";
import * as P_guide_execute_recovery from "./pages/guide-execute-recovery";
import * as P_guide_glossary from "./pages/guide-glossary";
import * as P_guide_faq from "./pages/guide-faq";
import * as P_contracts from "./pages/contracts";
import * as P_verify from "./pages/verify";
import * as P_license from "./pages/license";

export interface DocPageModule {
  readonly toc: readonly (readonly [string, string])[];
  readonly Page: (props: { d: DocsData }) => ReactNode;
}

export const DOC_MODULES: Readonly<Record<string, DocPageModule>> = {
  "welcome": P_welcome,
  "links": P_links,
  "wp-executive": P_wp_executive,
  "wp-problem": P_wp_problem,
  "wp-solution": P_wp_solution,
  "wp-inheritance": P_wp_inheritance,
  "wp-recovery": P_wp_recovery,
  "wp-fees": P_wp_fees,
  "wp-assets": P_wp_assets,
  "wp-features": P_wp_features,
  "wp-governance": P_wp_governance,
  "wp-security": P_wp_security,
  "wp-comparison": P_wp_comparison,
  "wp-market": P_wp_market,
  "wp-conclusion": P_wp_conclusion,
  "guide-wallet": P_guide_wallet,
  "guide-wrap": P_guide_wrap,
  "guide-heirs": P_guide_heirs,
  "guide-recovery": P_guide_recovery,
  "guide-active": P_guide_active,
  "guide-claim": P_guide_claim,
  "guide-execute-recovery": P_guide_execute_recovery,
  "guide-glossary": P_guide_glossary,
  "guide-faq": P_guide_faq,
  "contracts": P_contracts,
  "verify": P_verify,
  "license": P_license,
};
