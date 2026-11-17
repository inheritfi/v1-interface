// INHERITFI: "Setting Up Recovery Contacts" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { H2, Note, Ui } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["set", "Adding recovery contacts"], ["change", "Changing or removing contacts"]];

export function Page() {
  return (
    <>
      <p className="lead">Recovery contacts are the people you trust to get your funds out of a wallet you can no longer use. They are independent from your heirs, and they always come first.
      </p>
      <H2 id="set">Adding recovery contacts</H2>
      <ol className="steps-list">
      <li>Go to <Ui>Inheritance plan</Ui> and choose the asset.
      </li>
      <li>Select <Ui>Edit contacts</Ui>.
      </li>
      <li>Enter each contact's address. Select <Ui>Add contact</Ui> for more.
      </li>
      <li>Select <Ui>Review</Ui>, check every address in full, then select <Ui>Sign and save contacts</Ui> and confirm in your wallet.
      </li>
      </ol>
      <Note title="Each contact can take your whole balance" kind="warn">Any one of your recovery contacts can recover your whole balance of that asset, minus the recovery fee, once you have been inactive for the recovery period. Name only people you trust completely.</Note>
      <H2 id="change">Changing or removing contacts</H2>
      <p>Select <Ui>Edit contacts</Ui>, change or <Ui>Remove</Ui> the addresses you need, and save again. Saving always replaces your whole list of contacts for that asset, and it counts as activity. The same address can be both an heir and a recovery contact; the app points it out so you can make sure it's intended.
      </p>
    </>
  );
}
