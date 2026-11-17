// INHERITFI: "Claiming an Inheritance" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { H2, Note, Ui } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["open", "Opening the owner's plan"], ["start", "Starting the inheritance"], ["claim", "Claiming your share"], ["rest", "Claiming the rest"], ["several", "Several assets"]];

export function Page() {
  return (
    <>
      <p className="lead">If someone named you as an heir, this is how you follow their plan and claim your share when the time comes.
      </p>
      <H2 id="open">Opening the owner's plan</H2>
      <ol className="steps-list">
      <li>Open the link the owner sent you, or go to <Ui>I'm an heir</Ui>, enter the <Ui>Owner's address</Ui> and select <Ui>Show</Ui>.
      </li>
      <li>Connect the wallet the owner named as heir.
      </li>
      <li>The app lists every asset in which you are an heir of that owner, with your share, the owner's last activity and the inheritance timeline.
      </li>
      </ol>
      <H2 id="start">Starting the inheritance</H2>
      <p>Once the owner has been inactive for the inheritance period, the screen shows <Ui>The inheritance can start</Ui>. Select <Ui>Start the inheritance</Ui> and confirm in your wallet. Starting moves no funds; it opens the waiting period, during which the owner can still cancel everything by being active.
      </p>
      <H2 id="claim">Claiming your share</H2>
      <p>When claims open, the screen shows what you would receive if you claimed now, after the inheritance fee. Select <Ui>Claim my share</Ui> and confirm. Claim before the date shown. From then on, any heir who has already claimed can close the claims.
      </p>
      <H2 id="rest">Claiming the rest</H2>
      <p>Once the remaining-funds period has passed, heirs who claimed can share what is left, such as the shares of heirs who didn't claim and any iTokens that arrived later. Select <Ui>Claim the rest</Ui>. If some heirs haven't claimed yet, the app warns you that this closes the claims for everyone; to continue, select <Ui>Close claims and claim the rest</Ui>. If the owner receives more iTokens later, you can claim your part again.
      </p>
      <H2 id="several">Several assets</H2>
      <p>If you are an heir in more than one asset, <Ui>Start all</Ui> and <Ui>Claim all</Ui> handle them together, with one transaction per asset. What you receive arrives as iTokens in your wallet; you can unwrap them in <Ui>Wrap and unwrap</Ui>.
      </p>
      <Note title="Recovery contacts come first" kind="warn">If a recovery is in progress, the app shows it. A recovery contact who completes it receives the balance; if not, heirs can start the inheritance from the date shown.</Note>
    </>
  );
}
