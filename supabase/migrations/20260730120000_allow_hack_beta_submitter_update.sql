-- Migration: Allow hackathon beta submitters to update their own submission
-- Previously only admins could UPDATE. With the new upsert flow, a user
-- should be able to replace their own demo video with another Creative TV upload.

DROP POLICY IF EXISTS allow_update_hack_beta_submissions ON public.hack_beta_submissions;

CREATE POLICY allow_update_hack_beta_submissions
    ON public.hack_beta_submissions
    FOR UPDATE
    TO authenticated
    USING (
        private.is_hack_beta_admin()
        OR (
            auth.uid() IS NOT NULL
            AND LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
    )
    WITH CHECK (
        private.is_hack_beta_admin()
        OR (
            auth.uid() IS NOT NULL
            AND LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
    );

-- Admins can bypass the one-submission-per-wallet INSERT restriction.
DROP POLICY IF EXISTS allow_insert_hack_beta_submissions ON public.hack_beta_submissions;

CREATE POLICY allow_insert_hack_beta_submissions
    ON public.hack_beta_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        private.is_hack_beta_admin()
        OR (
            LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
            AND NOT EXISTS (
                SELECT 1
                FROM public.hack_beta_submissions AS existing
                WHERE LOWER(existing.wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
            )
        )
    );
