// INHERITFI: table of contents of the documentation (inheritfi.com/docs).
// Sections: Welcome, Technical Whitepaper, User Guides and Developers; no roadmap. One address per page.

export interface DocPageRef {
  /** Identifier of the page (name of the file in site/docs/pages). */
  readonly id: string;
  readonly title: string;
  /** Public path, always with a trailing slash. */
  readonly path: string;
}

export interface DocSection {
  readonly title: string;
  readonly pages: readonly DocPageRef[];
}

const p = (id: string, title: string, path: string): DocPageRef => ({ id, title, path });

export const DOCS_OUTLINE: readonly DocSection[] = [
  {
    title: "Welcome",
    pages: [p("welcome", "Introduction to the Protocol", "/docs/"), p("links", "Official Links & Social", "/docs/official-links/")],
  },
  {
    title: "Technical Whitepaper",
    pages: [
      p("wp-executive", "Executive Summary", "/docs/whitepaper/executive-summary/"),
      p("wp-problem", "The Problem We Solve", "/docs/whitepaper/the-problem/"),
      p("wp-solution", "The Solution: Inheritable Tokens", "/docs/whitepaper/inheritable-tokens/"),
      p("wp-inheritance", "Inheritance Mechanism", "/docs/whitepaper/inheritance/"),
      p("wp-recovery", "Recovery Mechanism", "/docs/whitepaper/recovery/"),
      p("wp-fees", "Fees", "/docs/whitepaper/fees/"),
      p("wp-assets", "Supported Assets and Their Risks", "/docs/whitepaper/supported-assets/"),
      p("wp-features", "Key Differentiators", "/docs/whitepaper/key-differentiators/"),
      p("wp-governance", "Protocol Governance & Continuity", "/docs/whitepaper/governance/"),
      p("wp-security", "Security Model", "/docs/whitepaper/security/"),
      p("wp-comparison", "INHERITFI vs. Traditional Estate Planning", "/docs/whitepaper/vs-traditional-estate-planning/"),
      p("wp-market", "Market Opportunity", "/docs/whitepaper/market-opportunity/"),
      p("wp-conclusion", "Conclusion", "/docs/whitepaper/conclusion/"),
    ],
  },
  {
    title: "User Guides",
    pages: [
      p("guide-wallet", "Connecting a Wallet", "/docs/guides/connecting-a-wallet/"),
      p("guide-wrap", "Wrapping and Unwrapping", "/docs/guides/wrapping-and-unwrapping/"),
      p("guide-heirs", "Setting Up Heirs", "/docs/guides/setting-up-heirs/"),
      p("guide-recovery", "Setting Up Recovery Contacts", "/docs/guides/setting-up-recovery-contacts/"),
      p("guide-active", "Staying Active", "/docs/guides/staying-active/"),
      p("guide-claim", "Claiming an Inheritance", "/docs/guides/claiming-an-inheritance/"),
      p("guide-execute-recovery", "Executing a Recovery", "/docs/guides/executing-a-recovery/"),
      p("guide-glossary", "Glossary of Terms", "/docs/guides/glossary/"),
      p("guide-faq", "Frequently Asked Questions", "/docs/guides/faq/"),
    ],
  },
  {
    title: "Developers",
    pages: [
      p("contracts", "Contract Addresses", "/docs/developers/contract-addresses/"),
      p("verify", "Verifying the Interface", "/docs/developers/verifying-the-interface/"),
      p("license", "License", "/docs/developers/license/"),
    ],
  },
];

/** All the pages in reading order (previous and next). */
export const DOC_PAGES: readonly (DocPageRef & { readonly section: string })[] = DOCS_OUTLINE.flatMap((s) => s.pages.map((pg) => ({ ...pg, section: s.title })));

/** Public path of a page by its identifier; throws if it does not exist (broken internal link = build error). */
export function docPath(id: string): string {
  const pg = DOC_PAGES.find((x) => x.id === id);
  if (pg === undefined) throw new Error(`Unknown docs page ${id}`);
  return pg.path;
}
