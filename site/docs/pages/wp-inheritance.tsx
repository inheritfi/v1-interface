// INHERITFI: "Inheritance Mechanism" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData, days } from "../data";
import { H2, Note, PeriodsNote } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["designate", "Designating heirs"], ["succession", "How succession runs"], ["shares", "Every heir gets exactly their share"], ["remaining", "Remaining funds"], ["defaults", "Default protocol periods"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">Every wallet holding iTokens can designate heirs for each asset. As long as you stay active, nothing changes for your heirs; they have no ability to move your funds.
      </p>
      <H2 id="designate">Designating heirs</H2>
      <p>For each asset you can name up to {d.maxHeirs.toString()} heirs, each with a percentage share. Shares must add up to exactly 100%, so no part of an estate is left unassigned or assigned twice. You can't name yourself, and the same address can't appear twice. You can update your heirs at any time while no inheritance or recovery is in progress; saving them also counts as activity.
      </p>
      <H2 id="succession">How succession runs</H2>
      <ol className="steps-list">
      <li><b>Inactivity.</b> After {days(d.p.inheritInactivityPeriod)} without activity with that asset, any heir can start the inheritance. Starting it moves no funds.
      </li>
      <li><b>Waiting period.</b> Claims open {days(d.p.inheritWaitingTime)} after the start. Until the inheritance ends, the owner can still cancel it with any activity.
      </li>
      <li><b>Claims.</b> After the waiting period, each heir claims their own share whenever they choose.
      </li>
      <li><b>Remaining funds.</b> After a further {days(d.p.inheritRemainingWaitingTime)}, any heir who has claimed can close the claims and split what is left among the heirs who claimed.
      </li>
      </ol>
      <H2 id="shares">Every heir gets exactly their share</H2>
      <p>The order in which heirs claim doesn't change what they receive. Every heir receives exactly their percentage of the estate.
      </p>
      <H2 id="remaining">Remaining funds</H2>
      <p>Some heirs may never claim, whether because of a lost key or an address nobody uses anymore. And the owner's wallet can keep receiving iTokens after the claims open. Once the remaining-funds period has passed, any heir who has claimed can distribute the whole remaining balance among the heirs who claimed, in proportion to their shares. From that moment, heirs who didn't claim can no longer claim in this inheritance. Heirs who claimed can repeat this step for any iTokens that arrive later.
      </p>
      <Note title="Recovery comes first" kind="warn">Recovery contacts can act after {days(d.p.recoveryInactivityPeriod)} without activity, before heirs. Starting a recovery cancels an inheritance in progress; what heirs have already claimed stays with them.</Note>
      <H2 id="defaults">Default protocol periods</H2>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>Period</th><th>At deployment</th>
      </tr>
      </thead>
      <tbody>
      <tr><td>Inactivity period</td><td>{days(d.p.inheritInactivityPeriod)}</td>
      </tr>
      <tr><td>Inheritance waiting period</td><td>{days(d.p.inheritWaitingTime)}</td>
      </tr>
      <tr><td>Remaining-funds waiting period</td><td>{days(d.p.inheritRemainingWaitingTime)} after the claims open</td>
      </tr>
      <tr><td>Inheritance fee</td><td>{d.fee} of each share</td>
      </tr>
      </tbody>
      </table>
      </div>
      <PeriodsNote />
    </>
  );
}
