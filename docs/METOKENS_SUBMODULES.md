# MeTokens Submodule Setup

Smart contract source lives in git submodules under `packages/metokens/`:

| Path | Repository | Branch |
|------|------------|--------|
| `packages/metokens/core` | [meTokens-core](https://github.com/sirgawain0x/meTokens-core) | `main` |
| `packages/metokens/erc20` | [meTokens-erc20](https://github.com/sirgawain0x/meTokens-erc20) | `main` |
| `packages/metokens/vesting` | [meTokens-vesting](https://github.com/sirgawain0x/meTokens-vesting) | `v2` |
| `packages/metokens/bancor` | [bancor-zero-formula](https://github.com/sirgawain0x/bancor-zero-formula) | `main` |

## Clone / update

After cloning crtv3:

```bash
git submodule update --init --recursive
```

To pull latest submodule commits:

```bash
git submodule update --remote --recursive
```

## Install & compile

```bash
yarn metokens:install
yarn metokens:compile
yarn metokens:test
```

## Inspect Base Diamond (Louper)

```bash
yarn metokens:inspect-diamond
yarn metokens:validate-deployments
```

Optional global Louper install:

```bash
npm install -g @mark3labs/louper-cli@latest
```

## Deployment manifest

Canonical Base addresses: [`deployments/metokens/base.json`](../deployments/metokens/base.json)

TypeScript imports: [`lib/contracts/metokens/deployments.ts`](../lib/contracts/metokens/deployments.ts)
