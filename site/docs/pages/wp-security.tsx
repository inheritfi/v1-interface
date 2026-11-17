// INHERITFI: "Security Model" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { H2, Note } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["foundations", "Built on audited foundations"], ["depth", "Defense in depth"], ["audit", "Audit status"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <H2 id="foundations">Built on audited foundations</H2>
      <p>The protocol builds on industry-standard, widely audited OpenZeppelin primitives: the ERC-20 token implementation, two-step ownership transfer, and reentrancy protection.
      </p>
      <H2 id="depth">Defense in depth</H2>
      <ul className="ticks">
      <li><b>Access control.</b> Each action is restricted to its authorized party. Only an heir can start or claim an inheritance, only a recovery contact can start or complete a recovery, and only the owner can change parameters, always within their limits.
      </li>
      <li><b>Waiting periods.</b> Every succession and every governance transition waits before it can execute.
      </li>
      <li><b>Reentrancy guards</b> on wrapping, unwrapping, inheritance, recovery and fee collection.
      </li>
      <li><b>Immutable contracts.</b> No proxy, no upgrade path, no pause function.
      </li>
      <li><b>Capped fees.</b> {d.maxFee} at most, written into the code as a constant.
      </li>
      </ul>
      <Note title="Security principle">No individual, including the founding team, can access user funds. Every wrap, unwrap, transfer, inheritance and recovery emits an on-chain event, so all activity can be audited independently by anyone.</Note>
      <H2 id="audit">Audit status</H2>
      <p>INHERITFI has not yet undergone a formal third-party audit. An external audit is planned, and its report will be published here as soon as it is complete.
      </p>
      <Note title="No external audit has been completed at this stage" kind="warn">Always check the contract addresses on this site before interacting with the contracts directly.</Note>
    </>
  );
}
