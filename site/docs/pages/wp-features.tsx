// INHERITFI: "Key Differentiators" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { H2 } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["dual", "Dual-track succession"], ["multi", "Percentage-based, multi-heir distribution"], ["timelocks", "Mandatory waiting periods"], ["transparency", "On-chain transparency"], ["custody", "No custodian"], ["contacts", "Recovery contacts"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <H2 id="dual">Dual-track succession</H2>
      <p>Wealth-transfer scenarios split into two categories: the owner has passed away (inheritance), or the owner is alive but locked out (recovery). INHERITFI handles both as distinct paths, each with its own people, inactivity thresholds and waiting periods, and recovery always comes first.
      </p>
      <H2 id="multi">Percentage-based, multi-heir distribution</H2>
      <p>An owner can designate up to {d.maxHeirs.toString()} heirs per asset, with precise percentage shares that must add up to exactly 100%. Every heir receives exactly their share, whatever the order in which heirs claim.
      </p>
      <H2 id="timelocks">Mandatory waiting periods</H2>
      <p>Every succession process requires a waiting period between its start and its execution, giving a living, active owner time to notice and cancel a process started by mistake. No combination of heirs or recovery contacts, even acting together, can skip the waiting period.
      </p>
      <H2 id="transparency">On-chain transparency</H2>
      <p>Every plan, every designation and every succession event is recorded on-chain. Heirs can verify their own designation directly, and the whole process can be inspected in a way no probate filing ever could.
      </p>
      <H2 id="custody">No custodian</H2>
      <p>The underlying assets are held by each asset's contract, which no one can upgrade, pause or redirect, and every iToken is backed 1:1. No company holds your funds, and while you're active no one but you, or someone you approve, can move your iTokens. The contract enforces rules; it never holds assets in a trust relationship on anyone's behalf.
      </p>
      <H2 id="contacts">Recovery contacts</H2>
      <p>Separate from heirs, an owner can name trusted recovery contacts who can get the funds out of a wallet the owner can no longer use. It is the path that matters when inheritance isn't the right one.
      </p>
    </>
  );
}
