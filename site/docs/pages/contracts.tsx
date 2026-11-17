// INHERITFI: "Contract Addresses" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { Addr, H2, LibraryRows, WrapperRows } from "../parts";
import { docPath } from "../outline";

export const toc: readonly (readonly [string, string])[] = [["wrappers", "Wrappers"], ["libraries", "Libraries"], ["owner", "Protocol owner"], ["verify-addr", "Check an address"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">Every supported asset has its own wrapper contract. The addresses below are read directly from the deployment manifest, the same file the app is built from. Never trust an address from a link, a DM or a third-party aggregator without checking it against this page.
      </p>
      <div className="facts">
      <div><span>Network</span><b>{d.network}, chain ID {d.chainId}</b>
      </div>
      <div><span>Contracts</span><b>{d.nAssets} wrappers and 2 libraries</b>
      </div>
      <div className="facts__wide"><span>Manifest SHA-256</span><b><code className="wrapcode">{d.manifestSha256}</code></b>
      </div>
      </div>
      <H2 id="wrappers">Wrappers</H2>
      <p>Each wrapper is an ERC-20 named <code>INHERITFI V1 &lt;asset&gt;</code> with symbol <code>i&lt;asset&gt;</code>. The risk label is explained in <a href={docPath("wp-assets")}>Supported Assets and Their Risks</a>.
      </p>
      <div className="tbl tbl--assets">
      <table>
      <thead>
      <tr><th>Asset</th><th>Contracts</th>
      </tr>
      </thead>
      <tbody><WrapperRows d={d} />
      </tbody>
      </table>
      </div>
      <H2 id="libraries">Libraries</H2>
      <p>The wrappers call two shared libraries for the heavy logic, so each contract stays under Ethereum's code size limit.
      </p>
      <div className="tbl tbl--assets">
      <table>
      <thead>
      <tr><th>Library</th><th>Address</th>
      </tr>
      </thead>
      <tbody><LibraryRows d={d} />
      </tbody>
      </table>
      </div>
      <H2 id="owner">Protocol owner</H2>
      <p><Addr a={d.owner} />
      </p>
      <p>What the owner can and can't do is in <a href={docPath("wp-governance")}>Protocol Governance &amp; Continuity</a>.
      </p>
      <H2 id="verify-addr">Check an address</H2>
      <ul className="ticks">
      <li>When it starts, the app checks on the chain that each contract listed here exists with the expected name, symbol, decimals and underlying token, and that its owner is the one above. It reports any difference.
      </li>
      <li>On a block explorer, a wrapper's <code>name()</code> and <code>symbol()</code> must match the table.
      </li>
      <li>Only trust addresses and links from inheritfi.com.
      </li>
      </ul>
    </>
  );
}
