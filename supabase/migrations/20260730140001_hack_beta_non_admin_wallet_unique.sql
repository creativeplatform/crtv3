-- Restore one-submission-per-wallet for non-admins at the DB layer.
-- Partial unique indexes cannot subquery other tables, so admin wallets are
-- listed explicitly (same set as private.hack_beta_admins / HACK_BETA_ADMIN_WALLETS).

CREATE UNIQUE INDEX IF NOT EXISTS idx_hack_beta_submissions_wallet_unique_non_admin
    ON public.hack_beta_submissions (LOWER(wallet_address))
    WHERE LOWER(wallet_address) NOT IN (
        LOWER('0xdE4b0371BBa20602685916ceeE5B22025a811734'),
        LOWER('0x6aBAa01C84b8b962D197E8a62598fea3Cfe0c5AD')
    );
