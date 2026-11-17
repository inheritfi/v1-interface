// INHERITFI: "Official Links & Social" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { Ext, H2 } from "../parts";
import { docPath } from "../outline";

export const toc: readonly (readonly [string, string])[] = [["sites", "Websites"], ["social", "Social"], ["safe", "Stay safe"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">These are the only official places for INHERITFI. Any other website, app or account that claims to be INHERITFI, including look-alike names, is not us.
      </p>
      <H2 id="sites">Websites</H2>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>What</th><th>Where</th>
      </tr>
      </thead>
      <tbody>
      <tr><td>Website</td><td><code>{d.siteHost}</code></td>
      </tr>
      <tr><td>App</td><td><code>{d.appHost}</code></td>
      </tr>
      <tr><td>Documentation</td><td><code>{d.siteHost}/docs</code></td>
      </tr>
      <tr><td>ENS name</td><td><code>inheritfi.eth</code></td>
      </tr>
      </tbody>
      </table>
      </div>
      <H2 id="social">Social</H2>
      <ul className="ticks">
      <li><Ext href={d.social.x}>X</Ext>
      </li>
      <li><Ext href={d.social.discord}>Discord</Ext>
      </li>
      <li><Ext href={d.social.github}>GitHub</Ext>
      </li>
      </ul>
      <H2 id="safe">Stay safe</H2>
      <ul className="ticks">
      <li>The app never asks for your recovery phrase or private key. It only asks your wallet to sign transactions, and your wallet shows you each one before you confirm.
      </li>
      <li>Check the address bar before you connect a wallet: the app lives only at <code>{d.appHost}</code>.
      </li>
      <li>Before you confirm a transaction, check that the contract is one of those in <a href={docPath("contracts")}>Contract Addresses</a>.
      </li>
      </ul>
    </>
  );
}
