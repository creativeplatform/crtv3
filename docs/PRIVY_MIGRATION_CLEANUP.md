# Post-Migration Cleanup Checklist

Run after nearly all users have logged in and completed wallet key migration.

## Remove migration stack

- [ ] Remove `@privy-io/alchemy-migration` and `MigrationProvider` from `app/providers.tsx`
- [ ] Remove `@privy-io/alchemy-migration/styles.css` import
- [ ] Uninstall `@account-kit/react` (if no longer required)

## Remove legacy Alchemy signer UI

- [ ] Remove `#alchemy-signer-iframe-container` from `app/layout.tsx`
- [ ] Delete `components/IframeCleanup.tsx` and related cleanup calls
- [ ] Delete `lib/sdk/accountKit/signer.ts`

## Simplify Privy config

- [ ] Remove `createWalletCreationOnLoginPlugin` from `lib/wallet/privy-config.ts`
- [ ] Keep `embeddedWallets.ethereum.createOnLogin: "users-without-wallets"`

## Optional package removal

Evaluate removing if unused:

- `@account-kit/core`, `@account-kit/signer`, `@account-kit/wallet-client`
- `@aa-sdk/core`, `@aa-sdk/ethers`
- Keep `@account-kit/smart-contracts` if still using `predictModularAccountV2Address`

## Config cleanup

- [ ] Remove legacy `config.ts` Account Kit `createConfig` if only used for migration
- [ ] Keep `queryClient` export in a slim `config.ts` or move to `lib/query-client.ts`
