// INHERITFI: "Frequently Asked Questions" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { H2 } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["custody", "Is my asset custodied by INHERITFI?"], ["noheirs", "What happens if I never set up heirs?"], ["change", "Can I change my heirs later?"], ["perasset", "Do I need a plan for every asset?"], ["gas", "Does checking in cost anything?"], ["alive", "What if I'm alive but forget to be active?"], ["both", "Can someone be both my heir and my recovery contact?"], ["later", "What happens to iTokens that arrive after an inheritance?"], ["owner", "Can the protocol owner take my funds?"], ["transfers", "Is there a fee to send iTokens?"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <H2 id="custody">Is my asset custodied by INHERITFI?</H2>
      <p>No. The underlying asset is held by its contract, which no one can upgrade, pause or redirect. Your iTokens stay in your own wallet, under your sole control. No company holds your funds.
      </p>
      <H2 id="noheirs">What happens if I never set up heirs?</H2>
      <p>Nothing changes for you. Heirs and recovery contacts are optional. Without heirs, no inheritance can start; without recovery contacts, no recovery can start.
      </p>
      <H2 id="change">Can I change my heirs later?</H2>
      <p>Yes, at any time while no inheritance or recovery is in progress. Saving your plan also counts as activity.
      </p>
      <H2 id="perasset">Do I need a plan for every asset?</H2>
      <p>Yes. Each asset has its own contract, its own clock and its own plan.
      </p>
      <H2 id="gas">Does checking in cost anything?</H2>
      <p>Only the network fee. Confirming you're active has no protocol fee and moves no funds.
      </p>
      <H2 id="alive">What if I'm alive but forget to be active?</H2>
      <p>Inactivity is the only signal the contracts have. Any activity cancels a recovery or an inheritance in progress, but what has already been recovered or claimed can't be returned. Keep your activity well within the recovery period.
      </p>
      <H2 id="both">Can someone be both my heir and my recovery contact?</H2>
      <p>Yes. The app points it out so you can make sure it's intended.
      </p>
      <H2 id="later">What happens to iTokens that arrive after an inheritance?</H2>
      <p>Heirs who claimed can claim the rest again, and recovery contacts can recover again whenever needed.
      </p>
      <H2 id="owner">Can the protocol owner take my funds?</H2>
      <p>No. The protocol owner can't move, freeze or seize anyone's balance, and every fee is capped at {d.maxFee} in the code.
      </p>
      <H2 id="transfers">Is there a fee to send iTokens?</H2>
      <p>No. Holding and sending iTokens is always free.
      </p>
    </>
  );
}
