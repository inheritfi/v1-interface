// INHERITFI: "INHERITFI vs. Traditional Estate Planning" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData, wholeDays } from "../data";
import { formatFee } from "../../params";

export const toc: readonly (readonly [string, string])[] = [];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">Side by side, the structural difference is direct: traditional estate planning depends on intermediaries and jurisdiction; INHERITFI depends on code that runs the same way everywhere, for everyone.
      </p>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>Factor</th><th>Traditional estate planning</th><th>INHERITFI</th>
      </tr>
      </thead>
      <tbody>
      <tr><td>Setup</td><td>1% to 3% of the estate in attorney fees</td><td>{formatFee(d.p.wrappingTax)} to wrap, capped in the code</td>
      </tr>
      <tr><td>Distribution</td><td>3% to 8% of the estate in probate costs</td><td>{formatFee(d.p.inheritanceTax)} of each share, no court involved</td>
      </tr>
      <tr><td>Time to distribute</td><td>6 months to 3 years</td><td>Heirs can claim from day {wholeDays(d.p.inheritInactivityPeriod + d.p.inheritWaitingTime).toString()} without activity</td>
      </tr>
      <tr><td>Geographic reach</td><td>Jurisdiction-specific</td><td>Global, borderless</td>
      </tr>
      <tr><td>Privacy</td><td>Public court records</td><td>Pseudonymous, on-chain</td>
      </tr>
      <tr><td>Dependence on advisors</td><td>Complete</td><td>None</td>
      </tr>
      </tbody>
      </table>
      </div>
      <p className="small">INHERITFI doesn't replace a will. See the <a href="/disclaimer/">Disclaimer</a>.
      </p>
    </>
  );
}
