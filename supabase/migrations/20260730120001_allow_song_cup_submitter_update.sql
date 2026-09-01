-- Migration: Allow song cup submitters to update their own submission
-- and let admins bypass the one-submission-per-wallet INSERT restriction.
-- The UI still prevents normal users from re-submitting; this just fixes
-- the duplicate-check race with RLS and gives admins flexibility.

DROP POLICY IF EXISTS allow_update_song_cup_submissions ON public.song_cup_submissions;

CREATE POLICY allow_update_song_cup_submissions
    ON public.song_cup_submissions
    FOR UPDATE
    TO authenticated
    USING (
        private.is_song_cup_admin()
        OR (
            auth.uid() IS NOT NULL
            AND LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
    )
    WITH CHECK (
        private.is_song_cup_admin()
        OR (
            auth.uid() IS NOT NULL
            AND LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
    );

DROP POLICY IF EXISTS allow_insert_song_cup_submissions ON public.song_cup_submissions;

CREATE POLICY allow_insert_song_cup_submissions
    ON public.song_cup_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        private.is_song_cup_admin()
        OR (
            LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
            AND NOT EXISTS (
                SELECT 1
                FROM public.song_cup_submissions AS existing
                WHERE LOWER(existing.wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
            )
        )
    );
