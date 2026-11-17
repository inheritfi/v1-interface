// INHERITFI: "Glossary of Terms" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.

export const toc: readonly (readonly [string, string])[] = [];

export function Page() {
  return (
    <>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>Term</th><th>Meaning</th>
      </tr>
      </thead>
      <tbody>
      <tr><td>Wrap</td><td>Deposit a supported asset and receive its iToken, backed 1:1.</td>
      </tr>
      <tr><td>Unwrap</td><td>Return iTokens and receive the underlying asset back.</td>
      </tr>
      <tr><td>iToken</td><td>The inheritable token of a wrapped asset, such as iETH or iDAI.</td>
      </tr>
      <tr><td>Owner</td><td>The wallet whose iTokens are covered by a plan.</td>
      </tr>
      <tr><td>Plan</td><td>The heirs and recovery contacts an owner has named for one asset.</td>
      </tr>
      <tr><td>Heir</td><td>A wallet that receives a percentage share of the owner's balance through an inheritance.</td>
      </tr>
      <tr><td>Recovery contact</td><td>A wallet the owner trusts to recover their whole balance if they lose access.</td>
      </tr>
      <tr><td>Activity</td><td>An action the owner signs with an asset, such as wrapping, unwrapping, sending iTokens, saving the plan or confirming they're active.</td>
      </tr>
      <tr><td>Inactivity period</td><td>How long an owner must be inactive with an asset before a recovery or an inheritance can start.</td>
      </tr>
      <tr><td>Waiting period</td><td>The time between the start of a recovery or inheritance and the moment it can be executed. Any activity from the owner cancels it.</td>
      </tr>
      <tr><td>Remaining funds</td><td>What is left after heirs claim, shared among the heirs who claimed.</td>
      </tr>
      <tr><td>Protocol owner</td><td>The account that can adjust parameters within the limits written in the contracts.</td>
      </tr>
      <tr><td>Delegate</td><td>A guardian of continuity who can help elect a new protocol owner if the current one falls silent.</td>
      </tr>
      </tbody>
      </table>
      </div>
    </>
  );
}
