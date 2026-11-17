// INHERITFI: "Market Opportunity" page of the documentation.
// The data (periods, fees, ranges, contracts, risks and licenses) come from site/docs/data.ts.
import { H2 } from "../parts";

export const toc: readonly (readonly [string, string])[] = [["category", "A category-defining position"], ["users", "Who it's for"], ["networks", "Multi-network expansion"]];

export function Page() {
  return (
    <>
      <H2 id="category">A category-defining position</H2>
      <p>INHERITFI is not fighting for share in an existing market. It defines a new one: inheritable digital assets. It is among the first complete, on-chain inheritance protocols for crypto, early in a category that grows directly with global crypto adoption.
      </p>
      <H2 id="users">Who it's for</H2>
      <ul className="ticks">
      <li><b>Long-term holders</b> protecting generational wealth in ETH and other majors.
      </li>
      <li><b>Stablecoin holders</b> making sure their balances reach their family.
      </li>
      <li><b>DeFi participants</b> who want succession planning for their on-chain positions.
      </li>
      <li><b>Family offices and high-net-worth individuals</b> who need crypto estate planning at an institutional standard.
      </li>
      <li><b>Crypto-native businesses</b> that need business continuity and key-person protection.
      </li>
      <li><b>Institutions and public entities</b> that hold crypto directly and need succession for their treasuries.
      </li>
      </ul>
      <H2 id="networks">Multi-network expansion</H2>
      <p>INHERITFI is live on Ethereum Mainnet and is designed with deployment on other networks in mind. Additional EVM networks and Layer 2s are expected to follow, each running the same protocol logic for its own users.
      </p>
    </>
  );
}
