# INHERITFI V1 Interface

Web app and public site of INHERITFI V1, the protocol that adds inheritance and recovery to ETH and 28 ERC-20 assets on Ethereum.

- App: https://app.inheritfi.com
- Website and documentation: https://inheritfi.com
- Contracts: https://github.com/inheritfi/v1-core

## What it is

- `src/`: the app. A static React site that talks to the contracts directly from the browser through the wallet (EIP-6963 extensions; no wallet SDK). Before letting you do anything it checks on the chain that every contract is the expected one.
- `site/`: the public site and the documentation, prerendered to static HTML.
- `contracts/`: the Ethereum mainnet deployment manifest with the ABIs, Multicall3 and the ERC-20 interface, each pinned by its SHA-256 in `contracts/pins.json`. `scripts/generate-contracts.mjs` turns them into `src/contracts/generated/`.

The app reads the chain only through `https://rpc.inheritfi.com` (see `src/web3/endpoints.ts`).

## Build and test

Requires Node.js 24.21 or later (below 25).

```sh
npm ci
npm test
npm run build        # app  -> dist/
npm run build:site   # site -> dist-site/
```

The builds are reproducible: the same commit produces the same files that are published.

## Security

No external security audit has been published for INHERITFI V1. Use it at your own risk and read the disclaimer at https://inheritfi.com/disclaimer/.

## License

Business Source License 1.1 (`BUSL-1.1`), see `LICENSE.txt`. Change Date: The earlier of 2030-11-10 or a date specified at v1-interface-license-date.inheritfi.eth. Change License: GNU General Public License v3.0 or later. Additional Use Grant: Any uses listed and defined at v1-interface-license-grants.inheritfi.eth.
