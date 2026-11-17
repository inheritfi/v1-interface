// INHERITFI: "Executing a Recovery" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { H2, Ui } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["open", "Opening the owner's plan"], ["start", "Starting the recovery"], ["recover", "Completing the recovery"], ["several", "Several assets"]];

export function Page() {
  return (
    <>
      <p className="lead">If someone named you as a recovery contact, this is how you recover their funds when they can no longer use their wallet.
      </p>
      <H2 id="open">Opening the owner's plan</H2>
      <ol className="steps-list">
      <li>Open the link the owner sent you, or go to <Ui>I'm a recovery contact</Ui>, enter the owner's address and select <Ui>Show</Ui>.
      </li>
      <li>Connect the wallet the owner named as recovery contact.
      </li>
      <li>The app lists every asset in which you are a recovery contact of that owner, with the owner's last activity, their balance and the recovery timeline.
      </li>
      </ol>
      <H2 id="start">Starting the recovery</H2>
      <p>Once the owner has been inactive for the recovery period, the screen shows <Ui>You can start a recovery</Ui>. Select <Ui>Start recovery</Ui> and confirm in your wallet. This begins the waiting period, during which the owner can cancel it by being active. You can start a recovery even when the balance is zero, to recover anything the owner receives later.
      </p>
      <H2 id="recover">Completing the recovery</H2>
      <p>After the waiting period, the screen shows what you will receive after the recovery fee. Select the recover button for that asset, for example <Ui>Recover iETH</Ui>, and confirm. The owner's whole balance of that asset goes to your wallet as iTokens. If the owner has several recovery contacts, the balance goes to the one who recovers first.
      </p>
      <p>Recovery doesn't split by percentage the way inheritance does, because its purpose is to get the funds out of a wallet the owner can no longer use, not to distribute an estate. The timeline also shows from when heirs can take over if the recovery isn't completed.
      </p>
      <H2 id="several">Several assets</H2>
      <p>If you are a recovery contact in more than one asset, <Ui>Start all</Ui> and <Ui>Recover all</Ui> handle them together, with one transaction per asset.
      </p>
    </>
  );
}
