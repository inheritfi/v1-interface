// INHERITFI: "Verifying the Interface" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { H2, Ui, appText } from "../parts";
import { docPath } from "../outline";

export const toc: readonly (readonly [string, string])[] = [["auto", "What the app checks on its own"], ["yourself", "What you can check yourself"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">The app is a static website that talks to the contracts directly from your browser. Before it lets you do anything, it checks on the chain that the contracts it's about to use are the right ones.
      </p>
      <H2 id="auto">What the app checks on its own</H2>
      <p>The list of contracts is built into the app from the same deployment manifest shown in <a href={docPath("contracts")}>Contract Addresses</a>. When the app starts, it reads the chain and checks:
      </p>
      <ul className="ticks">
      <li>that it's connected to the network the contracts were deployed on;
      </li>
      <li>that Multicall3, the standard contract it uses to read many values in one request, has its known code;
      </li>
      <li>that both libraries exist;
      </li>
      <li>that each of the {d.nAssets} wrappers exists with the expected name, symbol and decimals, and points to the expected underlying token, which must also exist;
      </li>
      <li>who owns each wrapper.
      </li>
      </ul>
      <p>If any of the first four checks fails, the app shows <Ui>{appText("integrity.mismatchTitle")}</Ui> and doesn't let you do anything. If a wrapper has a different owner, the app shows a warning.
      </p>
      <H2 id="yourself">What you can check yourself</H2>
      <ol className="steps-list">
      <li>Open the app only at <code>{d.appHost}</code>, from a link you trust, such as <a href={docPath("links")}>Official Links &amp; Social</a>.
      </li>
      <li>When your wallet asks you to confirm, check that the contract is one of the addresses in <a href={docPath("contracts")}>Contract Addresses</a>.
      </li>
      <li>On a block explorer, a wrapper's <code>name()</code> and <code>symbol()</code> must match the table on that page.
      </li>
      </ol>
    </>
  );
}
