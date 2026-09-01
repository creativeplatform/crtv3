# MeTokens Diamond Upgrade Runbook (Base)

Upgrade **facets** on the existing Diamond (`0xba5502db2aC2cBff189965e991C07109B14eB3f5`) — no full protocol redeploy.

Manifest: [`deployments/metokens/base.json`](../deployments/metokens/base.json)

## Pre-flight

```bash
git submodule update --init --recursive
yarn metokens:install
yarn metokens:compile
yarn metokens:validate-deployments
```

Set env: `ALCHEMY_API_KEY`, `PRIVATE_KEY` or `MNEMONIC`, `ETHERSCAN_API_KEY` (Basescan).

## Path A — Hardhat `deployUpgrade` (meTokens-core)

```bash
cd packages/metokens/core

yarn hardhat deployUpgrade \
  --diamond-address 0xba5502db2aC2cBff189965e991C07109B14eB3f5 \
  --diamond-upgrader <owner-or-multisig> \
  --facets-and-add-selectors "#HubFacet$$$<selector-to-add>*$$$<selector-to-remove>*" \
  --network base
```

Use `--use-multisig` when the Diamond owner is a multisig. Facet names match `contracts/facets/*.sol`.

Reference facet addresses before/after: `deployment/script-base.json`

## Path B — Louper CLI `diamond-cut`

```bash
npx louper diamond-cut --help

npx louper diamond-cut \
  -a 0xba5502db2aC2cBff189965e991C07109B14eB3f5 \
  -n base
```

Follow prompts to add, replace, or remove selectors. Requires compiled facet bytecode and admin key.

## Post-upgrade checklist

```bash
yarn metokens:inspect-diamond
yarn metokens:validate-deployments --write-louper-snapshot
```

1. If any facet **address** changed, update `deployments/metokens/base.json` and `packages/metokens/core/deployment/script-base.json`.
2. Commit manifest + louper snapshot diff in PR.
3. Redeploy subgraph only if event signatures or indexing logic changed.

## Registering new collateral hubs (not a Diamond upgrade)

Deploy vault via meTokens-core `add-vault`, then:

```bash
npx tsx scripts/metokens/register-stable-hub.ts
```

See [`USDC_HUB_SETUP.md`](USDC_HUB_SETUP.md).
