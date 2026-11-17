// INHERITFI: "Protocol Governance & Continuity" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData, days } from "../data";
import { H2, Note } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["limits", "What the owner can and can't do"], ["delegates", "Delegate system"], ["election", "A new owner, elected on-chain"], ["quorum", "Protection against silent delegates"], ["orphan", "Never orphaned"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">A protocol designed to guarantee inheritance across decades has to survive changes in its own stewardship. INHERITFI runs a governance layer entirely on-chain, independent of any single founding contributor's continued involvement.
      </p>
      <H2 id="limits">What the owner can and can't do</H2>
      <p>The protocol owner can adjust parameters, always within limits written into the contracts. The ones that shape your plan:
      </p>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>Parameter</th><th>At deployment</th><th>Allowed range</th>
      </tr>
      </thead>
      <tbody>
      <tr><td>Recovery inactivity period</td><td>{days(d.p.recoveryInactivityPeriod)}</td><td>{d.ranges.recoveryInactivityPeriod}, always shorter than the inheritance period</td>
      </tr>
      <tr><td>Inheritance inactivity period</td><td>{days(d.p.inheritInactivityPeriod)}</td><td>{d.ranges.inheritInactivityPeriod}</td>
      </tr>
      <tr><td>Inheritance waiting period</td><td>{days(d.p.inheritWaitingTime)}</td><td>{d.ranges.inheritWaitingTime}</td>
      </tr>
      <tr><td>Remaining-funds waiting period</td><td>{days(d.p.inheritRemainingWaitingTime)}</td><td>{d.ranges.inheritRemainingWaitingTime}</td>
      </tr>
      <tr><td>Recovery waiting period</td><td>{days(d.p.recoveryWaitingTime)}</td><td>{d.ranges.recoveryWaitingTime}, always shorter than the recovery priority</td>
      </tr>
      <tr><td>Recovery priority over heirs</td><td>{days(d.p.recoveryExecutionWindow)}</td><td>{d.ranges.recoveryExecutionWindow}</td>
      </tr>
      <tr><td>Each of the four fees</td><td>{d.fee}</td><td>0% to {d.maxFee}</td>
      </tr>
      </tbody>
      </table>
      </div>
      <p>The owner can change these periods within their limits, and a change also applies to plans already set up. The app always shows the current values.
      </p>
      <p>The owner can't move, freeze or seize anyone's balance, can't change the succession logic, and can't pause the contracts, because there is no pause function.
      </p>
      <H2 id="delegates">Delegate system</H2>
      <p>INHERITFI is the first protocol designed so it can never be left without a steward. The owner appoints a council of delegates, each holding a share of the voting power, and no single delegate can ever reach a majority alone. The owner can never be a delegate, so the guardians of continuity always stay independent of the owner they protect.
      </p>
      <H2 id="election">A new owner, elected on-chain</H2>
      <p>Every action the owner takes is a proof of life. If the owner ever falls silent, the delegates can elect a successor entirely on-chain. They nominate a candidate, the candidate accepts, and a true majority of voting power decides. A mandatory waiting period follows before the transition becomes final, and a single action from the current owner at any point cancels it all. No one can rush it, and no one can force it.
      </p>
      <H2 id="quorum">Protection against silent delegates</H2>
      <p>Continuity can't depend on everyone staying present. If too many delegates go silent for an election to reach a majority, any active delegate can call the roll. Those who answer carry the protocol forward, and a new owner can always be elected. Even if only one delegate answers, the protocol still finds its way. None of this ever touches user balances or anyone's plan.
      </p>
      <H2 id="orphan">Never orphaned</H2>
      <p>Even if the owner renounces ownership, the delegates remain, ready to elect a new steward. Through silence, absence or renunciation, INHERITFI always has a path forward. It protects your inheritance, and it can never be left without an heir of its own.
      </p>
      <Note title="Governance safety guarantee">No single party (not the founding team, not a delegate) can redirect user funds or change the succession logic. The code is the law, and the governance layer is built so the code always has a path forward.</Note>
    </>
  );
}
