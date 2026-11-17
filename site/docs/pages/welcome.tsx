// INHERITFI: "Introduction to the Protocol" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData, days } from "../data";
import { H2, PeriodsNote } from "../parts";
import { docPath } from "../outline";

export const toc: readonly (readonly [string, string])[] = [["problem", "The problem it solves"], ["how", "How it works"], ["network", "Network"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">INHERITFI is a fully decentralized, on-chain inheritance protocol. There are no custodians, no intermediaries, and no off-chain trustees holding your assets. Everything is enforced directly by smart contracts.
      </p>
      <H2 id="problem">The problem it solves</H2>
      <p>Billions of dollars in crypto are already lost for good because a key holder passed away, lost access, or became incapacitated, with no way for their family to recover or inherit the funds. Traditional estate planning tools were never built for self-custodied assets.
      </p>
      <H2 id="how">How it works</H2>
      <p>INHERITFI solves this with a simple idea: you deposit ("wrap") a supported asset and receive a 1:1 backed inheritable token, an <b>iToken</b>. While you're active, you hold and move your iTokens exactly as before. If you go inactive with that asset for the configured period, the heirs you designated can start and execute the succession, entirely on-chain and governed only by the smart contract's rules.
      </p>
      <p>A separate <b>Recovery</b> mechanism covers the more common case of simply losing access to a wallet. The recovery contacts you trust can move your whole balance of that asset, minus a small fee, to their own wallet after a shorter period, so it isn't lost with your keys. Recovery always comes before inheritance.
      </p>
      <div className="cards"> <a className="dcard" href={docPath("wp-solution")}><b>Wrap</b><span>{d.nAssets} supported assets, each with its own contract and its own iToken.</span></a> <a className="dcard" href={docPath("guide-heirs")}><b>Designate</b><span>Up to {d.maxHeirs.toString()} heirs per asset, with shares that add up to exactly 100%.</span></a> <a className="dcard" href={docPath("guide-active")}><b>Live</b><span>Using your iTokens keeps your plan dormant. No heir or contact can act.</span></a> <a className="dcard" href={docPath("wp-inheritance")}><b>Inherit</b><span>After {days(d.p.inheritInactivityPeriod)} without activity, your heirs can start the succession.</span></a>
      </div>
      <H2 id="network">Network</H2>
      <p>INHERITFI is live on Ethereum Mainnet. Ethereum is our foundation, the network with the deepest liquidity, security, and asset coverage for what we're building. We're working to extend INHERITFI to additional networks and Layer 2s, so more of the ecosystem can be protected without compromising on the security guarantees the protocol is built on.
      </p>
      <PeriodsNote />
    </>
  );
}
