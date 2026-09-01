# MeTokens contract packages

Git submodules wrapping the meTokens protocol source repos.

| Submodule | Role |
|-----------|------|
| **core** | EIP-2535 Diamond, facets, vaults, Hardhat deploy/upgrade tasks |
| **erc20** | Standalone ERC20 MeToken implementation (reference; core includes `MeToken.sol`) |
| **bancor** | Bancor bonding curve formula (reference; core inlines curve via `LibCurve.sol`) |
| **vesting** | Vesting contracts (optional integrations) |

## Compile (Hardhat, Solidity 0.8.9)

```bash
yarn metokens:install   # from repo root
yarn metokens:compile
```

## Base deployment reference

Canonical addresses live in [`../../deployments/metokens/base.json`](../../deployments/metokens/base.json).

Hardhat snapshot: `core/deployment/script-base.json`

## Dependency notes

`meTokens-core` is self-contained for compilation. The **erc20** and **bancor** submodules are kept in sync with upstream for audits, diffs, and future facet work — not linked via npm `file:` paths today because `LibCurve` and `MeToken.sol` already live in core.

When upgrading curve logic, compare changes against `packages/metokens/bancor/contracts/BancorZeroFormula.sol` before cutting facets on Base.
