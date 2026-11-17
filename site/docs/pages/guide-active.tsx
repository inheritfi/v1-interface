// INHERITFI: "Staying Active" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData, days } from "../data";
import { H2, Note } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["check", "Checking in"], ["automatic", "Activity that counts automatically"], ["per-asset", "One clock per asset"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">Staying active is what keeps your plan dormant. As long as you're active with an asset, no heir or recovery contact can act on it.
      </p>
      <H2 id="check">Checking in</H2>
      <ol className="steps-list">
      <li>Open the app and go to <i>Inheritance plan</i>.
      </li>
      <li>Choose the asset you want to check. Its plan shows your last activity and after how long your recovery contacts and heirs can act.
      </li>
      <li>If an inheritance or recovery has been started, the plan flags it.
      </li>
      <li>Select <i>Confirm I'm active</i> and approve the transaction in your wallet. This resets the clock for that asset and cancels any inheritance or recovery in progress.
      </li>
      </ol>
      <p>Checking in moves no funds; you only pay the network fee. It needs a balance or earlier activity in that asset, so if you have neither, wrap some first.
      </p>
      <H2 id="automatic">Activity that counts automatically</H2>
      <p>Wrapping, unwrapping, sending iTokens from your wallet, and saving your heirs or recovery contacts all count as activity for that asset. If you use the protocol regularly, you don't strictly need to check in. Checking in is the way to reset the clock without moving funds.
      </p>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>Counts as activity</th><th>Doesn't count</th>
      </tr>
      </thead>
      <tbody>
      <tr><td>Wrapping or unwrapping</td><td>Receiving iTokens</td>
      </tr>
      <tr><td>Sending iTokens from your wallet</td><td>A transfer made by someone you approved</td>
      </tr>
      <tr><td>Saving your heirs or recovery contacts</td><td>Approving someone to spend your iTokens</td>
      </tr>
      <tr><td><i>Confirm I'm active</i></td><td>Activity with another asset, or outside INHERITFI</td>
      </tr>
      </tbody>
      </table>
      </div>
      <H2 id="per-asset">One clock per asset</H2>
      <p>Each asset has its own contract and its own clock, so activity with iETH doesn't count for iDAI. Your recovery contacts can act first, after {days(d.p.recoveryInactivityPeriod)} without activity, so that is the period to keep in mind for every asset you hold.
      </p>
      <Note title="Inactivity is the only signal" kind="warn">The contracts can't know why you stopped. If you don't use an asset for the period, for any reason, the people you named can act, even if you are alive. Cancelling stops a process, but can't return what has already been recovered or claimed.</Note>
    </>
  );
}
