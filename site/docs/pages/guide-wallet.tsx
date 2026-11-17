// INHERITFI: "Connecting a Wallet" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
// "Detected" and "Other wallets" are taken from the app texts, so the guide always says what the app shows.
import { H2, Ui, appText } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["connect", "Connecting"], ["first", "Where the app opens"], ["safety", "Built-in safety check"]];

export function Page() {
  return (
    <>
      <p className="lead">You need a connected wallet before the app can show your balances or ask you to sign anything. Connecting never gives the app custody of your funds or your keys.
      </p>
      <H2 id="connect">Connecting</H2>
      <ol className="steps-list">
      <li>Open the app and select <Ui>Connect wallet</Ui>.
      </li>
      <li>Choose your wallet: MetaMask, Coinbase Wallet, Rabby Wallet or Phantom. Wallets installed in your browser show <Ui>{appText("wallet.detected")}</Ui>. Other wallet extensions you have installed appear under <Ui>{appText("wallet.others")}</Ui>. If your wallet is not installed, the app shows a link to its official download page.
      </li>
      <li>Approve the connection in your wallet.
      </li>
      <li>The app now shows <Ui>Connected</Ui> and your address.
      </li>
      </ol>
      <p>By connecting a wallet, you confirm that you have read, understood, and agree to the <a href="/disclaimer/">INHERITFI Disclaimer</a>. If two extensions claim to be the same wallet, or an extension uses the name of one of these four, the app blocks it.
      </p>
      <p>If your wallet is on another network, the app shows <Ui>Wrong network</Ui>. Select <Ui>Switch network</Ui> and approve the change in your wallet. To disconnect at any time, select <Ui>Disconnect</Ui>.
      </p>
      <H2 id="first">Where the app opens</H2>
      <p>Once connected, the app reads your account. If you already have wrapped assets or a plan, it opens <Ui>Inheritance plan</Ui>; otherwise it opens <Ui>Wrap and unwrap</Ui>. You can move between the four sections at any time: <Ui>Inheritance plan</Ui>, <Ui>Wrap and unwrap</Ui>, <Ui>I'm an heir</Ui> and <Ui>I'm a recovery contact</Ui>.
      </p>
      <H2 id="safety">Built-in safety check</H2>
      <p>Before it shows anything, the app checks on the network that every contract matches this interface. If something doesn't match, it stops and shows nothing, so you never act on wrong information.
      </p>
    </>
  );
}
