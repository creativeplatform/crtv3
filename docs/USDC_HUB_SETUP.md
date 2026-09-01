# USDC Hub Setup for MeTokens (Base)

Only **Hub 1 (DAI)** is registered on the MeTokens Diamond today. USDC support requires an on-chain hub registration before the app can offer it in the hub selector.

## Current on-chain state (Base)

| Hub | Asset | Vault | Status |
|-----|-------|-------|--------|
| 1 | DAI `0x50c572…` | `0xff6Eb470…` | Active |
| 2+ | — | — | Not registered |

## What the app already supports

- Hub-aware collateral parsing (DAI 18 decimals, USDC 6 decimals)
- Hub selector in MeToken creation (lists only **active** hubs from chain)
- Subgraph `Hub` entity from `Register` events
- Admin script: `scripts/metokens/register-usdc-hub.ts`

## Steps to enable USDC (protocol admin)

These steps follow [meTokens-core](https://github.com/meTokens/meTokens-core) Hardhat tasks:

### 1. Deploy / register a USDC vault

```bash
# In meTokens-core repo (submodule packages/metokens/core), on Base:
yarn hardhat add-vault \
  --diamond 0xba5502db2aC2cBff189965e991C07109B14eB3f5 \
  --registry <VaultRegistry> \
  --vault <NewUSDCVault> \
  --network base
```

Diamond address is canonical in [`deployments/metokens/base.json`](deployments/metokens/base.json).

Use the same curve parameters as Hub 1 unless you have reason to change them (`baseY: 224`, `reserveWeight: 32`, `refundRatio: 800000` = 80% in ppm, max `1e6`).

### 2. Register the USDC hub on the Diamond

```bash
USDC_VAULT_ADDRESS=0xYourVault \
DIAMOND_OWNER_PRIVATE_KEY=0x... \
npx tsx scripts/metokens/register-usdc-hub.ts
```

Or call `register(owner, asset, vault, refundRatio, baseY, reserveWeight, encodedVaultArgs)` on the Diamond from any admin wallet.

USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### 3. Sync Turbo pipelines (subgraph 1.0.3 on Studio)

Graph Studio deploy **1.0.3** indexes `Hub` and `MeTokenBalance`. Mirror to Goldsky at the same version, then apply pipelines:

```bash
turbo pipeline apply pipeline-metokens-balances.yaml
turbo pipeline apply pipeline-metokens-hubs.yaml
# or sync all MeToken entities:
turbo pipeline apply pipeline-metokens-all.yaml
```

### 4. Verify in the app

- Open **Create MeToken** — Hub selector should show **Hub 3 — USDC** once registered on-chain
- Portfolio uses `meTokenBalances(where: { user })` instead of scanning all tokens

## Subgraph balance index

`MeTokenBalance` is updated from:

- `Subscribe` → credits owner `minted`
- `Mint` → credits `recipient`
- `Burn` → debits `burner`

On-chain `balanceOf` in the app verifies indexed values. P2P transfers after initial mint are reconciled via the on-chain read in `useMeTokenHoldings`.

Query example:

```graphql
{
  meTokenBalances(where: { user: "0x...", balance_gt: 0 }) {
    meToken
    balance
  }
}
```
