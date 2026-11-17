// INHERITFI: "Setting Up Heirs" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { H2, Note, Ui } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["set", "Naming your heirs"], ["change", "Changing or removing heirs"], ["share", "Let your heirs know"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">Heirs are the wallets that receive your iTokens if you stop being active. Each asset has its own plan, so you name heirs separately for every asset you want covered.
      </p>
      <H2 id="set">Naming your heirs</H2>
      <ol className="steps-list">
      <li>Go to <Ui>Inheritance plan</Ui> and choose the asset. You need a wrapped balance in that asset first.
      </li>
      <li>Select <Ui>Edit heirs</Ui>.
      </li>
      <li>Enter each heir's address and share. Select <Ui>Add heir</Ui> for more rows, or <Ui>Split evenly</Ui> to divide 100% among them.
      </li>
      <li>Check that the total is exactly 100%, then select <Ui>Review</Ui>.
      </li>
      <li>Check every address in full, select <Ui>Sign and save heirs</Ui>, and confirm in your wallet.
      </li>
      </ol>
      <p>You can name up to {d.maxHeirs.toString()} heirs per asset, with shares in steps of 0.01%. You can't name your own address, and the same address can't appear twice.
      </p>
      <H2 id="change">Changing or removing heirs</H2>
      <p>Select <Ui>Edit heirs</Ui>, change an address or a share, or select <Ui>Remove</Ui> next to a row, and save again. Saving always replaces your whole list of heirs for that asset, and it counts as activity. While an inheritance or a recovery is in progress, your plan can't be changed, so select <Ui>Confirm I'm active</Ui> first to cancel it.
      </p>
      <H2 id="share">Let your heirs know</H2>
      <p>Once your plan is saved, select <Ui>Copy link for your heirs and contacts</Ui> and send the link to them. It only contains your address; it doesn't give anyone access to your funds. With it, your heirs can follow the plan from the app without typing your address.
      </p>
      <Note title="Heirs can't touch your funds">While you remain active, your heirs can see their designation, but they have no way to move anything.</Note>
    </>
  );
}
