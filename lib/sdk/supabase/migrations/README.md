# Song Cup + Hack Beta Migrations

## Song Cup

Copy `00001_song_cup_submissions.sql` (and later Song Cup migrations) into the **Supabase Dashboard → SQL Editor** and run. Migrations are idempotent.

## Hack Beta (`00006_hack_beta_submissions.sql`)

Creates:

- `public.hack_beta_submissions` — demo submissions (library video + Grove receipt)
- `private.hack_beta_admins` — admin wallets
- `public.hack_beta_settings` — singleton row for `mixtape_playlist_url`

Seeded admins:

- `0xdE4b0371BBa20602685916ceeE5B22025a811734`
- `0x6aBAa01C84b8b962D197E8a62598fea3Cfe0c5AD`

RLS mirrors Song Cup: public sees approved; owners see own rows; admins see/update all. Settings are publicly readable; only admins can update the mixtape URL.

```sql
INSERT INTO private.hack_beta_admins (wallet_address)
VALUES ('0xYourAdminWalletHere')
ON CONFLICT (wallet_address) DO NOTHING;
```

For admin checks, the signed-in user's `app_metadata.wallet_address` must match (same as Song Cup).

## Song Cup favorites (`00008_song_cup_submission_is_favorite.sql`)

Adds `is_favorite BOOLEAN` to `song_cup_submissions` (same pattern as Hack Beta). Admins toggle favorite in the review UI; favoriting also sets `status = 'approved'`. Existing approved rows are backfilled as favorites.

## Security model (shared)

- **Public SELECT**: only `status = 'approved'`
- **Owner SELECT**: own rows
- **Admin SELECT/UPDATE**: `private.*_admins`
- **INSERT**: authenticated users

> To prevent `wallet_address` spoofing at insert time, set `app_metadata.wallet_address` server-side using the Supabase service role.

## Admin RLS Policies (`00007_admin_rls_policies.sql`)

Adds RLS policies targeting `service_role` on `private.song_cup_admins` and `private.hack_beta_admins` to satisfy database security audits/scanners that flag tables that have RLS enabled but no policies defined.

