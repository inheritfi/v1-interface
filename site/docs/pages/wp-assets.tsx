// INHERITFI: "Supported Assets and Their Risks" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { Chips, H2, Note, RiskNotices } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["list", "Supported assets"], ["criteria", "Admission criteria"], ["notices", "Asset notices"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">INHERITFI supports {d.nAssets} assets: ETH and {d.nAssets - 1} leading ERC-20 tokens. Each one has its own contract, its own iToken, and its own plans.
      </p>
      <H2 id="list">Supported assets</H2>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>Risk</th><th>Assets</th>
      </tr>
      </thead>
      <tbody>
      <tr><td><span className="tag tag--native">Native</span></td><td>
      <Chips d={d} kind="native" /></td>
      </tr>
      <tr><td><span className="tag tag--standard">Standard</span></td><td>
      <Chips d={d} kind="standard" /></td>
      </tr>
      <tr><td><span className="tag tag--pausable">Pausable</span></td><td>
      <Chips d={d} kind="pausable" /></td>
      </tr>
      <tr><td><span className="tag tag--governance">Governance</span></td><td>
      <Chips d={d} kind="governance" /></td>
      </tr>
      </tbody>
      </table>
      </div>
      <ul className="ticks">
      <li><b>Native:</b> ETH itself. There is no token contract and no issuer.
      </li>
      <li><b>Standard:</b> the issuer has no power over holders' balances.
      </li>
      <li><b>Pausable:</b> the issuer can pause all transfers of the token.
      </li>
      <li><b>Governance:</b> a DAO, through on-chain votes, can change the token or move balances.
      </li>
      </ul>
      <p>In the app, Pausable and Governance assets carry a <i>Notice</i> label, and their notice is shown before you wrap.
      </p>
      <H2 id="criteria">Admission criteria</H2>
      <p>Every asset is reviewed on-chain before it's added. An asset is excluded if any account or multisig other than a DAO's on-chain governance can move, burn or arbitrarily change balances or rules. It is admitted with a notice if those powers can only be reached through a DAO's on-chain vote, or if its issuer can only pause transfers.
      </p>
      <p>We're working to add more assets over time, each one reviewed under the same admission criteria, so more of the ecosystem can be protected without weakening the guarantees the protocol is built on.
      </p>
      <H2 id="notices">Asset notices</H2>
      <p>The app shows these notices before you wrap the asset:
      </p>
      <RiskNotices />
      <Note title="The underlying asset's risks remain">Wrapping doesn't remove the risks of the asset itself. INHERITFI can't override powers that an issuer or a DAO has over its own token.</Note>
    </>
  );
}
