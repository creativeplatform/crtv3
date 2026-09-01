-- Migration: One Song Cup submission per wallet
-- Apply in Supabase Dashboard → SQL Editor (idempotent).

-- Normalize any mixed-case wallet rows before unique index (safe no-op if already lowercase)
UPDATE public.song_cup_submissions
SET wallet_address = LOWER(wallet_address)
WHERE wallet_address <> LOWER(wallet_address);

CREATE UNIQUE INDEX IF NOT EXISTS idx_song_cup_submissions_wallet_unique
    ON public.song_cup_submissions (LOWER(wallet_address));

DROP POLICY IF EXISTS allow_insert_song_cup_submissions ON public.song_cup_submissions;

CREATE POLICY allow_insert_song_cup_submissions
    ON public.song_cup_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        AND NOT EXISTS (
            SELECT 1
            FROM public.song_cup_submissions AS existing
            WHERE LOWER(existing.wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
    );
