import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { OwnerPlanScreen } from "./screens/OwnerPlanScreen";
import { WrapScreen } from "./screens/WrapScreen";
import { ownerFromHash, SECTION_HASH, sectionFromHash, type Section } from "./lib/section";
import { HeirScreen } from "./screens/HeirScreen";
import { ContactScreen } from "./screens/ContactScreen";
import { EntryResolver } from "./screens/EntryResolver";
import { useTx } from "./web3/useTx";
import { IntegrityGate } from "./web3/IntegrityGate";
import { WalletStatus } from "./web3/WalletStatus";
import { t, type MessageKey } from "./i18n";
import { LanguageSelect } from "./i18n/LanguageProvider";
import { BrandIcon, BrandWord } from "./components/Brand";
import { AppMenu } from "./components/AppMenu";
import type { AppLinks } from "./lib/links";

/**
 * Menu links of this build. vite.config.ts writes them at build time (appLinks in lib/links.ts, with INHERITFI_ENV),
 * so the bundle carries only the links of its own environment.
 */
declare const __INHERITFI_APP_LINKS__: AppLinks;
const links = __INHERITFI_APP_LINKS__;

/** Menu sections. `section`: the screen it opens (in the URL, #plan or #wrap); those that do not have a screen yet, null. */
const SECTIONS: readonly { label: MessageKey; section: Section | null }[] = [
  { label: "nav.plan", section: "plan" },
  { label: "nav.wrap", section: "wrap" },
  { label: "nav.heir", section: "heir" },
  { label: "nav.contact", section: "contact" },
];

/**
 * Section according to the URL (#plan or #wrap): it is remembered on reload and follows the browser's back and forward buttons.
 * `decide` sets the entry screen without creating a new history entry (replaceState).
 */
function useHashSection(): {
  hash: string;
  fromUrl: Section | null;
  go: (s: Section) => void;
  decide: (s: Section) => void;
  goHash: (h: string) => void;
  replaceHash: (h: string) => void;
} {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  const go = (s: Section) => {
    const h = SECTION_HASH[s];
    setHash(h);
    if (window.location.hash !== h) window.location.hash = h;
  };
  const goHash = (h: string) => {
    setHash(h);
    if (window.location.hash !== h) window.location.hash = h;
  };
  /** Changes the URL without creating a new history entry (the back button does not return to the replaced URL). */
  const replaceHash = (h: string) => {
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search + h);
    setHash(h);
  };
  const decide = (s: Section) => {
    replaceHash(SECTION_HASH[s]);
  };
  return { hash, fromUrl: sectionFromHash(hash), go, decide, goHash, replaceHash };
}

export function App() {
  const connection = useConnection();
  const account = connection.status === "connected" ? connection.address : undefined;
  const { hash, fromUrl, go, decide, goHash, replaceHash } = useHashSection();
  // No section in the URL: without a wallet, wrap; with a wallet, the entry screen is decided with the first read
  // of the account (EntryResolver) and written into the URL, so it does not change again on its own.
  const section: Section | null = fromUrl ?? (account === undefined ? "wrap" : null);
  // Only one transaction at a time for the whole application: the state stays visible when changing screens.
  const tx = useTx(account);

  return (
    <div className="app">
      <nav className="app__nav" aria-label={t("nav.main")}>
        <div className="app__lockup">
          <a className="app__brand" href={`${links.site}/`} aria-label={t("menu.home")}>
            <BrandIcon className="app__icon" />
            <BrandWord className="app__word" />
          </a>
          <AppMenu links={links} />
        </div>
        <ul>
          {SECTIONS.map(({ label, section: target }) => (
            <li key={label}>
              <button
                type="button"
                className="app__link"
                aria-current={target !== null && target === section ? "page" : undefined}
                disabled={target === null}
                onClick={() => {
                  if (target !== null) go(target);
                }}
              >
                {t(label)}
              </button>
            </li>
          ))}
        </ul>
        <LanguageSelect />
        <WalletStatus disclaimerUrl={`${links.site}/disclaimer/`} />
      </nav>
      <main className="app__main">
        <IntegrityGate>
          {section === null && account !== undefined ? (
            <EntryResolver account={account} onDecide={decide} />
          ) : section === "heir" ? (
            <HeirScreen account={account} owner={ownerFromHash(hash)} tx={tx} onOwner={goHash} onRedirect={replaceHash} />
          ) : section === "contact" ? (
            <ContactScreen account={account} owner={ownerFromHash(hash)} tx={tx} onOwner={goHash} />
          ) : section === "wrap" ? (
            <WrapScreen account={account} tx={tx} />
          ) : (
            <OwnerPlanScreen account={account} tx={tx} />
          )}
        </IntegrityGate>
      </main>
    </div>
  );
}
