// INHERITFI: common pieces of the documentation pages .
import type { ReactNode } from "react";
import { t, type MessageKey } from "../../src/i18n";
import type { RiskKind } from "../../src/lib/assetRisk";
import { EXTERNAL } from "../pages/Layout";
import type { DocsData } from "./data";
import type { LicenseParams } from "./license";

/** Section title with its anchor. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id}>
      <a className="anchor" href={`#${id}`} aria-label="Link to this section">
        #
      </a>
      {children}
    </h2>
  );
}

/** Note or warning box. */
export function Note({ title, kind = "note", children }: { title: string; kind?: "note" | "warn"; children: ReactNode }) {
  return (
    <div className={`call call--${kind}`}>
      <b>{title}</b>
      <p>{children}</p>
    </div>
  );
}

/** Name of a button or of an app text, in italics. */
export function Ui({ children }: { children: ReactNode }) {
  return <i>{children}</i>;
}

/** App text by its key (the same one the user sees). */
export function appText(key: MessageKey): string {
  return t(key);
}

/** Address with a button to copy it (site/client/main.ts). */
export function Addr({ a }: { a: string }) {
  return (
    <span className="addr">
      <code>{a}</code>
      <button type="button" className="copy" data-copy={a} aria-label="Copy address">
        Copy
      </button>
    </span>
  );
}

/** Link to an external site: always in a new tab. */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} {...EXTERNAL}>
      {children}
    </a>
  );
}

const RISK_NAME: Readonly<Record<RiskKind, string>> = { native: "Native", standard: "Standard", pausable: "Pausable", governance: "Governance" };

export function riskName(kind: RiskKind): string {
  return RISK_NAME[kind];
}

/** Tickers of a risk category, in the order of the manifest. */
export function Chips({ d, kind }: { d: DocsData; kind: RiskKind }) {
  return (
    <div className="chips">
      {d.assets
        .filter((a) => d.risk(a.ticker) === kind)
        .map((a) => (
          <span key={a.ticker} className="chip-s">
            {a.ticker}
          </span>
        ))}
    </div>
  );
}

const NOTICE_ORDER: readonly { ticker: string; title: MessageKey; body: MessageKey }[] = [
  { ticker: "WBTC", title: "risk.wbtcTitle", body: "risk.wbtcBody" },
  { ticker: "FET", title: "risk.fetTitle", body: "risk.fetBody" },
  { ticker: "AAVE", title: "risk.aaveTitle", body: "risk.aaveBody" },
  { ticker: "LDO", title: "risk.ldoTitle", body: "risk.ldoBody" },
];

/** The risk notices of the app, as they are (the assets with Notice). */
export function RiskNotices() {
  return (
    <>
      {NOTICE_ORDER.map((n) => (
        <div key={n.ticker} className="call call--warn">
          <b>{n.ticker}</b>
          <p>{`${t(n.title)} ${t(n.body)}`}</p>
        </div>
      ))}
    </>
  );
}

/** Rows of the wrappers table (Contract Addresses). */
export function WrapperRows({ d }: { d: DocsData }) {
  return (
    <>
      {d.assets.map((a) => {
        const k = d.risk(a.ticker);
        return (
          <tr key={a.ticker}>
            <td className="asset">
              <b>{a.iToken.symbol}</b>
              <small>Wraps {a.ticker}</small>
              <span className={`tag tag--${k}`}>{riskName(k)}</span>
            </td>
            <td>
              <dl className="pair">
                <dt>Wrapper</dt>
                <dd>
                  <Addr a={a.address} />
                </dd>
                <dt>Underlying</dt>
                <dd>{a.underlying.kind === "native" ? <span className="muted">Native ETH, no token contract</span> : <Addr a={a.underlying.address} />}</dd>
              </dl>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** Rows of the libraries table. */
export function LibraryRows({ d }: { d: DocsData }) {
  return (
    <>
      {d.libraries.map((l) => (
        <tr key={l.name}>
          <td className="asset">
            <b>{l.name}</b>
          </td>
          <td>
            <Addr a={l.address} />
          </td>
        </tr>
      ))}
    </>
  );
}

/** Parameter table of a license. */
export function LicTable({ id, title, l }: { id: string; title: string; l: LicenseParams }) {
  return (
    <>
      <H2 id={id}>{title}</H2>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Licensed Work</td>
              <td>{l.work}</td>
            </tr>
            <tr>
              <td>Licensor</td>
              <td>{l.licensor}</td>
            </tr>
            <tr>
              <td>Additional Use Grant</td>
              <td>
                Any uses listed and defined at <code className="wrapcode">{l.grant}</code>
              </td>
            </tr>
            <tr>
              <td>Change Date</td>
              <td>
                The earlier of {l.date} or a date specified at <code className="wrapcode">{l.dateEns}</code>
              </td>
            </tr>
            <tr>
              <td>Change License</td>
              <td>{l.change}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Common note: the values of the pages are those of the deployment. */
export function PeriodsNote() {
  return (
    <Note title="Values at deployment">
      Periods and fees on these pages are the values set when the contracts were deployed. They can change within limits
      written in the contracts, and the app always shows the current values for each asset.
    </Note>
  );
}
