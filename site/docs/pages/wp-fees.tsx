// INHERITFI: "Fees" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { type DocsData } from "../data";
import { H2, PeriodsNote } from "../parts";
import { formatFee } from "../../params";

export const toc: readonly (readonly [string, string])[] = [["table", "Protocol fees"], ["cap", "Capped in the code"], ["where", "Where fees go"]];

export function Page({ d }: { d: DocsData }) {
  return (
    <>
      <p className="lead">INHERITFI charges four small fees, each capped in the code at {d.maxFee}. Holding and sending iTokens is always free.
      </p>
      <H2 id="table">Protocol fees</H2>
      <div className="tbl">
      <table>
      <thead>
      <tr><th>Action</th><th>Fee at deployment</th><th>Charged on</th>
      </tr>
      </thead>
      <tbody>
      <tr><td>Wrap</td><td>{formatFee(d.p.wrappingTax)}</td><td>The amount you deposit</td>
      </tr>
      <tr><td>Unwrap</td><td>{formatFee(d.p.unwrappingTax)}</td><td>The amount you unwrap</td>
      </tr>
      <tr><td>Inheritance</td><td>{formatFee(d.p.inheritanceTax)}</td><td>Each share an heir receives, including remaining funds</td>
      </tr>
      <tr><td>Recovery</td><td>{formatFee(d.p.recoveryTax)}</td><td>The balance recovered</td>
      </tr>
      <tr><td>Sending iTokens</td><td>Free</td><td>No fee, ever</td>
      </tr>
      </tbody>
      </table>
      </div>
      <p>Fees are rounded down to the token's smallest unit, never up. The network fee (gas) of each transaction is separate and goes to the Ethereum network, not to INHERITFI.
      </p>
      <H2 id="cap">Capped in the code</H2>
      <p>The {d.maxFee} cap is a constant written into the contracts. Fees can be lowered, but no one, including the protocol owner, can ever raise any of them above {d.maxFee}.
      </p>
      <H2 id="where">Where fees go</H2>
      <p>Fees are kept by each asset's contract as iTokens, fully backed like any other, and are distributed to the protocol's treasury wallets.
      </p>
      <PeriodsNote />
    </>
  );
}
