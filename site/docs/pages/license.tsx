// INHERITFI: "License" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { H2, LicTable } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["contracts-lic", "Contracts"], ["interface-lic", "Interface"], ["allows", "What the license allows"], ["open", "When it becomes open source"], ["future", "Future versions"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">Both parts of INHERITFI V1, the smart contracts and the interface, are licensed under the Business Source License 1.1 (BUSL 1.1).
      </p>
      <LicTable id="contracts-lic" title="Contracts" l={d.license.core} />
      <LicTable id="interface-lic" title="Interface" l={d.license.iface} />
      <H2 id="allows">What the license allows</H2>
      <p>You can copy, modify, create derivative works, redistribute and make non-production use of the code. Production use is allowed as described in the Additional Use Grant, published at the ENS name listed above.
      </p>
      <H2 id="open">When it becomes open source</H2>
      <p>On the Change Date, the code becomes available under the {d.license.core.change}. As the license itself sets, this also happens on the fourth anniversary of the first public distribution of a version, if that comes first.
      </p>
      <H2 id="future">Future versions</H2>
      <p>Each future version or tool of INHERITFI will have its own license, with its own terms and dates. A new version never changes the V1 contracts. They can't be upgraded, so a plan set up today keeps running on the same code, under the rules written in it.
      </p>
      <p>The full license text is included with the source code, in <code>LICENSE.txt</code>.
      </p>
    </>
  );
}
