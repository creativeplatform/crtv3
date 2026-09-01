-- Allow hack-beta admin wallets to submit multiple demos.
-- Non-admin wallets remain limited to one submission via RLS INSERT policy
-- and application upsert logic. The old unique-on-wallet index blocked admin
-- multi-submit at the DB layer even though RLS already allowed it.

DROP INDEX IF EXISTS public.idx_hack_beta_submissions_wallet_unique;

-- Prevent the same Creative TV asset from being entered twice by the same wallet
-- (admins included). Different videos from an admin wallet are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hack_beta_submissions_wallet_video_unique
    ON public.hack_beta_submissions (LOWER(wallet_address), video_asset_id);

-- One submission per wallet for non-admins. Admin wallets are excluded so they
-- can submit multiple demos. Addresses must stay in sync with
-- private.hack_beta_admins / HACK_BETA_ADMIN_WALLETS.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hack_beta_submissions_wallet_unique_non_admin
    ON public.hack_beta_submissions (LOWER(wallet_address))
    WHERE LOWER(wallet_address) NOT IN (
        LOWER('0xdE4b0371BBa20602685916ceeE5B22025a811734'),
        LOWER('0x6aBAa01C84b8b962D197E8a62598fea3Cfe0c5AD')
    );

-- Non-unique lookup helper for wallet listings (admins may have many rows).
CREATE INDEX IF NOT EXISTS idx_hack_beta_submissions_wallet_lower
    ON public.hack_beta_submissions (LOWER(wallet_address));
