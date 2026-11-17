// INHERITFI: "Wrapping and Unwrapping" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { H2, Ui } from "../parts";
import { docPath } from "../outline";

export const toc: readonly (readonly [string, string])[] = [["wrap", "Wrapping"], ["approval", "Approvals for ERC-20 tokens"], ["notices", "Asset notices"], ["unwrap", "Unwrapping"]];

export function Page() {
  return (
    <>
      <p className="lead">Wrapping turns a supported asset into its inheritable iToken, for example ETH into iETH. Only wrapped balances can have heirs and recovery contacts. You can unwrap at any time; wrapping never locks your funds.
      </p>
      <H2 id="wrap">Wrapping</H2>
      <ol className="steps-list">
      <li>Go to <Ui>Wrap and unwrap</Ui>.
      </li>
      <li>Under <Ui>Assets</Ui>, choose the asset; you can search it by its ticker. Each asset shows what you have in your wallet and what you have wrapped.
      </li>
      <li>Select <Ui>Wrap</Ui>, or <Ui>Wrap more</Ui> if you already hold that iToken.
      </li>
      <li>Enter the amount, or select <Ui>Max</Ui>. The summary shows exactly what you send, the fee, and the iTokens you receive.
      </li>
      <li>Select <Ui>Wrap</Ui> and confirm in your wallet.
      </li>
      </ol>
      <p>When you wrap ETH, <Ui>Max</Ui> keeps enough ETH aside to pay the network fee, so the transaction can go through.
      </p>
      <H2 id="approval">Approvals for ERC-20 tokens</H2>
      <p>To wrap an ERC-20 token, the asset's contract first needs your approval. The app always asks for an approval of exactly the amount you're wrapping, to that asset's contract only, and never an unlimited one. Your wallet will ask you to confirm the approval and then the wrap. If an earlier approval for a different amount is still open, the app first sets it to zero. An approval that is still open is shown on the screen, and you can remove it with <Ui>Cancel approval</Ui>.
      </p>
      <H2 id="notices">Asset notices</H2>
      <p>For assets whose issuer or DAO holds special powers over the token, the app shows a notice before you wrap. Read it first, and see <a href={docPath("wp-assets")}>Supported Assets and Their Risks</a> for details.
      </p>
      <H2 id="unwrap">Unwrapping</H2>
      <ol className="steps-list">
      <li>In <Ui>Wrap and unwrap</Ui>, choose the asset.
      </li>
      <li>Select <Ui>Unwrap</Ui>.
      </li>
      <li>Enter the amount, or select <Ui>Max</Ui>. The summary shows the fee and what you receive.
      </li>
      <li>Select <Ui>Unwrap</Ui> and confirm in your wallet.
      </li>
      </ol>
      <p>Wrapping and unwrapping both count as activity for that asset. Unwrapping also reduces the balance your heirs or recovery contacts could receive, so keep it in mind if you have a plan for that asset.
      </p>
    </>
  );
}
