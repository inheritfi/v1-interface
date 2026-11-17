// INHERITFI: "Recovery Mechanism" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData, days } from "../data";
import { H2, Note, PeriodsNote } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["how", "How recovery works"], ["first", "Recovery comes first"], ["later", "Funds that arrive later"], ["defaults", "Default protocol periods"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">Recovery is a separate flow from inheritance, designed for the far more common case of simply losing access to your wallet, such as a lost device or a lost seed phrase. You choose your own recovery contacts, who may or may not be your heirs.
      </p>
      <H2 id="how">How recovery works</H2>
      <ol className="steps-list">
      <li><b>Inactivity.</b> After {days(d.p.recoveryInactivityPeriod)} without activity with an asset, any of your recovery contacts can start a recovery.
      </li>
      <li><b>Waiting period.</b> For {days(d.p.recoveryWaitingTime)}, the recovery can't be completed. Any activity from you, at any time before it's completed, cancels it.
      </li>
      <li><b>Completion.</b> After the waiting period, any of your recovery contacts can complete it. Your whole balance of that asset, minus the {d.fee} recovery fee, goes to the contact who completes it.
      </li>
      </ol>
      <p>Recovery doesn't split by percentage the way inheritance does, because its purpose is to get your funds out of a wallet you can no longer use, into the hands of someone you trust.
      </p>
      <H2 id="first">Recovery comes first</H2>
      <p>Recovery has a shorter inactivity period than inheritance, matching its higher urgency, and it always takes priority:
      </p>
      <ul className="ticks">
      <li>Starting a recovery cancels an inheritance in progress. What heirs have already claimed stays with them.
      </li>
      <li>While a recovery is in progress, heirs can't start an inheritance until {days(d.p.recoveryExecutionWindow)} after the recovery started. From then on they can, and doing so cancels the recovery and resumes the inheritance where it stopped: heirs who already claimed can't claim again. Until an heir does, the contact can still complete it.
      </li>
      </ul>
      <H2 id="later">Funds that arrive later</H2>
      <p>A recovery contact can start a recovery even when your balance is zero, so anything you receive later can still be recovered. Recovery can be repeated as many times as needed, for example when more iTokens arrive at your old wallet.
      </p>
      <Note title="Choose your contacts carefully" kind="warn">Any one of your recovery contacts can take your whole balance of that asset once the conditions are met. Name only people you trust completely, and remember that each asset has its own list.</Note>
      <H2 id="defaults">Default protocol periods</H2>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>Period</th><th>At deployment</th>
      </tr>
      </thead>
      <tbody>
      <tr><td>Recovery inactivity period</td><td>{days(d.p.recoveryInactivityPeriod)}</td>
      </tr>
      <tr><td>Recovery waiting period</td><td>{days(d.p.recoveryWaitingTime)}</td>
      </tr>
      <tr><td>Recovery priority over heirs</td><td>{days(d.p.recoveryExecutionWindow)} from the start of the recovery</td>
      </tr>
      <tr><td>Recovery fee</td><td>{d.fee} of the balance recovered</td>
      </tr>
      </tbody>
      </table>
      </div>
      <p>Inheritance and recovery share the same activity clock, with different thresholds. Setting up one doesn't set up the other.
      </p>
      <PeriodsNote />
    </>
  );
}
