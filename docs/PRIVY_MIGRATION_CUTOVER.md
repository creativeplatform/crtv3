# Privy + Wallet APIs v5 — Production Cutover (Step 4)

Follow this checklist when deploying the signer migration to production.

## Prerequisites

- [ ] Privy app configured with email, passkey, Google, Twitch (no Facebook)
- [ ] Privy **allowed domains** include production + staging URLs
- [ ] OAuth **redirect URLs** configured for Google/Twitch (`NEXT_PUBLIC_URL` or Vercel URL)
- [ ] `NEXT_PUBLIC_PRIVY_APP_ID` and `NEXT_PUBLIC_PRIVY_CLIENT_ID` set in Vercel
- [ ] Alchemy Gas Manager policy linked to the same app as `NEXT_PUBLIC_ALCHEMY_API_KEY`
- [ ] CSP allows Privy (`auth.privy.io`, WalletConnect) — see `next.config.mjs` headers
- [ ] Staging validated: login, send transaction, migration modal for test Alchemy user

## Cutover sequence (critical)

**Order: Deploy → Export → Import** (never export before deploy).

1. **Pause new signups briefly** (optional maintenance window)
2. **Deploy** this branch to production (Privy + `MigrationProvider` live)
3. **Export users** from Alchemy Dashboard → Wallets → Export → download JSON
4. **Import users** into Privy Dashboard → User management → Users → Import users
5. **Verify** a returning user sees the migration modal and completes key transfer
6. **Monitor** migration completion; users who log in later can still migrate

If export ran before deploy, run a **second export** after deploy to catch signups in the gap.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Migration modal never appears | User not imported — delete Privy user, re-import from Alchemy export |
| Modal never appears | Privy auto-created wallet first — confirm `createWalletCreationOnLoginPlugin` is active |
| Wrong wallet address on send | Ensure non-7702 mode: `requestAccount({ accountType: "sma-b" })` + `account: scaAddress` |

## Post-migration cleanup (after ~100% key transfer)

See `docs/PRIVY_MIGRATION_CLEANUP.md`.
