// INHERITFI: "The Problem We Solve" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { H2 } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["silent", "Silent, compounding wealth destruction"], ["fail", "Why existing approaches fail"], ["scale", "Scale of the opportunity"]];

export function Page() {
  return (
    <>
      <H2 id="silent">Silent, compounding wealth destruction</H2>
      <p>Traditional finance built centuries of infrastructure for generational wealth transfer: wills, trusts, probate courts, estate attorneys, bank beneficiary designations. Digital assets inherited none of it. The gap compounds every year crypto adoption grows without a native succession layer.
      </p>
      <p>Death is only the most visible failure mode. Incapacitation is just as destructive. A medical emergency can leave someone unable to recall a seed phrase; an accident can leave credentials unreachable; a device can be lost or destroyed with no backup. Every scenario ends the same way: assets frozen, families locked out, wealth destroyed by design rather than by malice.
      </p>
      <p>The scale is already visible on-chain. An estimated 3 to 4 million bitcoin, close to a fifth of the 21 million that will ever exist, are considered permanently lost. Some keys died with their owners; others sit on drives thrown away by mistake, behind forgotten passwords, or in early wallets nobody can trace anymore.
      </p>
      <H2 id="fail">Why existing approaches fail</H2>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>Approach</th><th>Where it breaks</th>
      </tr>
      </thead>
      <tbody>
      <tr><td>Sharing seed phrases with family</td><td>Destroys security while the owner is alive; depends entirely on human memory and unconditional trust.</td>
      </tr>
      <tr><td>Centralized exchange inheritance</td><td>Months of legal process, and the assets must be custodied, giving up self-custody in the first place.</td>
      </tr>
      <tr><td>Multi-signature wallets</td><td>Demand technical skill from heirs; keys can still be lost with no fallback.</td>
      </tr>
      <tr><td>Hardware wallet with written instructions</td><td>Physical-document risk, no enforcement, and no waiting period to catch a mistake.</td>
      </tr>
      <tr><td>Trusting an attorney with credentials</td><td>Brings back a central point of failure; the attorney may pass away before the client.</td>
      </tr>
      </tbody>
      </table>
      </div>
      <p>Every existing option requires either trusting a third party or heirs who are technically sophisticated. Neither holds up at scale. Succession has to be automatic, trustless, and ask nothing of heirs beyond claiming what is already theirs.
      </p>
      <H2 id="scale">Scale of the opportunity</H2>
      <p>In the United States alone, about $124 trillion is expected to pass from one generation to the next by 2048. Crypto's share of that transfer grows every year adoption climbs, and with an estimated 600 million+ crypto users worldwide, the people exposed to this problem are no longer a niche. The first generation of Bitcoin and Ethereum holders is aging in real time. This is not a future problem waiting for a future solution. It is happening now, in a market with almost no infrastructure built to solve it.
      </p>
    </>
  );
}
