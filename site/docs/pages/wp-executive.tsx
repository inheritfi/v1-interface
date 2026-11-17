// INHERITFI: "Executive Summary" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData, iTokenOf } from "../data";
import { H2, Note } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["removes", "INHERITFI removes that failure mode"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">Every year, crypto that was never stolen disappears for good. The private keys of owners who passed away or became incapacitated take their digital wealth with them. There is no institution to call, no court with jurisdiction over a seed phrase, no recovery process. The assets sit on-chain, visible and unreachable.
      </p>
      <H2 id="removes">INHERITFI removes that failure mode</H2>
      <p>INHERITFI is a fully decentralized, trustless, on-chain inheritance and recovery protocol. Users wrap supported assets into inheritable tokens ({["ETH", "WBTC", "DAI"].map((x) => iTokenOf(d, x)).join(", ")} and the rest of the {d.nAssets} supported assets), designate heirs and recovery contacts, and encode a digital estate plan directly into smart contract logic that no one can change. No lawyers, no custodians, no single point of failure.
      </p>
      <Note title="The core promise">Any asset wrapped through INHERITFI becomes inheritable. If the owner passes away or loses access, the people they named can claim it, under rules enforced by code rather than by a promise.</Note>
      <p>The protocol runs on Ethereum and is designed with future deployment on other networks in mind. It is not an incremental feature inside an existing product category. It defines a new one: inheritable digital assets.
      </p>
    </>
  );
}
