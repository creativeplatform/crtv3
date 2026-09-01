-- Migration: Structured Song Cup submission fields + admin-only SELECT policy
-- Apply in Supabase Dashboard → SQL Editor (idempotent).

ALTER TABLE public.song_cup_submissions
    ADD COLUMN IF NOT EXISTS artist_handle TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS cover_url TEXT,
    ADD COLUMN IF NOT EXISTS cover_hash TEXT,
    ADD COLUMN IF NOT EXISTS attestation_uid TEXT;

CREATE INDEX IF NOT EXISTS idx_song_cup_submissions_status_created
    ON public.song_cup_submissions (status, created_at DESC);

-- Tighten SELECT: admins see all; submitters see own rows only (no public approved leak)
DROP POLICY IF EXISTS allow_select_song_cup_submissions ON public.song_cup_submissions;

CREATE POLICY allow_select_song_cup_submissions
    ON public.song_cup_submissions
    FOR SELECT
    TO anon, authenticated
    USING (
        (
            auth.uid() IS NOT NULL
            AND LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
        OR private.is_song_cup_admin()
    );
