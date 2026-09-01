# MeTokens Contracts (Base)

Canonical deployment manifest: [`deployments/metokens/base.json`](../deployments/metokens/base.json)

TypeScript exports: [`lib/contracts/metokens/deployments.ts`](../lib/contracts/metokens/deployments.ts)

Submodules: [`METOKENS_SUBMODULES.md`](METOKENS_SUBMODULES.md)

## Base mainnet (chainId 8453)

| Contract | Address | Basescan |
|----------|---------|----------|
| Diamond | `0xba5502db2aC2cBff189965e991C07109B14eB3f5` | [link](https://basescan.org/address/0xba5502db2aC2cBff189965e991C07109B14eB3f5) |
| MeTokenFactory | `0xb31Ae2583d983faa7D8C8304e6A16E414721A0B` | [link](https://basescan.org/address/0xb31Ae2583d983faa7D8C8304e6A16E414721A0B) |

### Facets (live on Diamond)

| Facet | Address |
|-------|---------|
| DiamondCutFacet | `0x2256CF92163748AF1B30bb0a477C68672Fb14432` |
| HubFacet | `0x0bb01A58802eC340069C68698726A7cB358195F8` |
| FoundryFacet | `0xA360aeb1C0915E1ebb5F83c533d94ae2EB827Ea8` |
| CurveFacet | `0x52e813d7738a430188a0515Dfe7b8177240CCb9B` |
| FeesFacet | `0x4431a3AEb5610FB7082d4Cb0D6b100C288C443b8` |
| MeTokenRegistryFacet | `0xCb44364CCdb30fc79e7852e778bEc20033a69b8B` |
| DiamondLoupeFacet | `0x5A7861D29088B67Cc03d85c4D89B855201e030EB` |
| OwnershipFacet | `0xACef1f621DA7a4814696c73EA33F9bD639e15FC9` |

### Hub 1 (DAI, active)

| Field | Value |
|-------|-------|
| Asset | DAI `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` |
| Vault | `0xff6Eb470bf0D817B17DFD596F1B2b3110682a40f` |

VaultRegistry and MigrationRegistry on Base are **TBD** in the manifest until confirmed on-chain.

## Inspect with Louper CLI

```bash
yarn metokens:inspect-diamond
yarn metokens:validate-deployments
```

JSON snapshot (optional): `yarn metokens:validate-deployments --write-louper-snapshot`

## Hub registration (admin)

```bash
HUB_SYMBOL=USDC VAULT_ADDRESS=0x... DIAMOND_OWNER_PRIVATE_KEY=0x... \
  npx tsx scripts/metokens/register-stable-hub.ts
```

See [`USDC_HUB_SETUP.md`](USDC_HUB_SETUP.md).

## Subgraph

- **Graph Studio (primary)**: `GRAPH_STUDIO_CREATIVE_PLATFORM_URL` — deploy tag **1.0.3** (`Hub`, `MeTokenBalance`, P2P `Transfer` indexing)
- **Goldsky (fallback)**: `metokens/1.0.3` — see `METOKENS_GOLDSKY_VERSION` in `lib/subgraph/creative-platform-proxy.ts`
- **Turbo**: `pipeline-metokens-balances.yaml`, `pipeline-metokens-hubs.yaml`, `pipeline-metokens-all.yaml`

## Upgrade vs register

- **Upgrade (ERC-2535):** replace facet logic on the existing Diamond via `diamondCut` — see [`METOKENS_UPGRADE_RUNBOOK.md`](METOKENS_UPGRADE_RUNBOOK.md).
- **Register hub:** deploy a new vault + call `register()` — does not redeploy the Diamond.

## Ethereum mainnet reference

Legacy deployment: `packages/metokens/core/deployment/script-mainnet.json`  
Diamond: `0x0B4ec400e8D10218D0869a5b0036eA4BCf92d905`  
The Creative app MeToken **UI targets Base only**.
