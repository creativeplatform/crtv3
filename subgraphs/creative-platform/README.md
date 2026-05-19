# Creative Platform Subgraph

Merged Graph Studio subgraph for the Creative Platform on Base:
- MeTokens entities: `Subscribe`, `Mint`, `Burn`, `Register` (GraphQL field names match Goldsky `metokens/1.0.2`: `timestamp_`, `block_number`, `transactionHash_`, `contractId_`, etc.)
- Reality.eth entities: `Question`, `Answer`

## MeTokens data source

Events are indexed from the **MeTokens Diamond** on Base (`0xba5502db2aC2cBff189965e991C07109B14eB3f5`), not the factory. Event ABIs match [meTokens-core](https://github.com/meTokens/meTokens-core) (`IMeTokenRegistryFacet`, `IFoundryFacet`, `IHubFacet`).

`startBlock` is set to `16584541` (early hub activity on Base); lower it if you need full history.

## Quick Start

1. Install dependencies:
   - `cd subgraphs/creative-platform`
   - `yarn install`
2. Authenticate:
   - `GRAPH_STUDIO_DEPLOY_KEY=<deploy-key> yarn auth:studio`
3. Generate + build:
   - `yarn codegen`
   - `yarn build`
4. Deploy to Studio:
   - `VERSION_LABEL=v0.0.1 yarn deploy:studio:tag`

## Reality.eth

- Contract: `0x2F39f464d16402Ca3D8527dA89617b73DE2F60e8`
- `startBlock`: `26260675`

Keep Goldsky routes enabled until parity checks pass (`scripts/graph-studio/parity-check.ts`).
