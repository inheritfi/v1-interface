// INHERITFI: "The Solution: Inheritable Tokens" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData, days, wholeDays } from "../data";
import { H2, Note } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["itoken", "Inheritable tokens"], ["journey", "The user journey"], ["heartbeat", "The heartbeat"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">An inheritable token is a standard ERC-20 token, backed 1:1 by the asset deposited, that carries programmable succession logic.
      </p>
      <H2 id="itoken">Inheritable tokens</H2>
      <p>Wrapping ETH into iETH, or DAI into iDAI, makes the position inheritable without handing control to anyone and without asking anything of your heirs until a succession actually begins. For every iToken in circulation, its contract holds one unit of the asset, and you can unwrap whenever you want.
      </p>
      <p>Like any other ERC-20, an iToken can be held, sent, and used wherever ERC-20 tokens are accepted. It carries one addition: an estate plan, enforced by the contract, that activates only under conditions you defined in advance.
      </p>
      <H2 id="journey">The user journey</H2>
      <ol className="steps-list">
      <li><b>Wrap.</b> Deposit a supported asset and receive its 1:1 backed iToken.
      </li>
      <li><b>Designate.</b> Name heirs with percentage shares that add up to exactly 100%, and the recovery contacts you trust.
      </li>
      <li><b>Live.</b> Use your iTokens normally. Your own activity resets the inactivity clock automatically.
      </li>
      <li><b>Recover.</b> If you lose access, after {days(d.p.recoveryInactivityPeriod)} without activity a recovery contact can recover your balance of that asset.
      </li>
      <li><b>Trigger.</b> After {days(d.p.inheritInactivityPeriod)} without activity, any heir can start the inheritance.
      </li>
      <li><b>Claim.</b> After a {wholeDays(d.p.inheritWaitingTime).toString()}-day waiting period, each heir claims their own share.
      </li>
      </ol>
      <H2 id="heartbeat">The heartbeat</H2>
      <p>The protocol tracks a digital heartbeat for every wallet and every asset. Every action you sign with that asset counts: wrapping, unwrapping, sending iTokens, saving your plan, or simply confirming you're active. As long as you remain active, no succession can begin. Only real, sustained inactivity opens the window for your recovery contacts and heirs. Receiving iTokens doesn't count, so no one else can keep your clock running for you.
      </p>
      <Note title="Your crypto is yours until it isn't">While you are present, you keep full control. When you are not, the people you named can step in, exactly as you specified in advance.</Note>
    </>
  );
}
