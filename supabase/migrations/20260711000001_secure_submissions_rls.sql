-- Migration: Secure RLS policies for submissions
-- Tightens INSERT policies so users can only submit under their own authenticated wallet address
-- and only if they do not already have an active submission.

-- 1. Tighten song_cup_submissions RLS INSERT policy
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

-- 2. Tighten hack_beta_submissions RLS INSERT policy
DROP POLICY IF EXISTS allow_insert_hack_beta_submissions ON public.hack_beta_submissions;

CREATE POLICY allow_insert_hack_beta_submissions
    ON public.hack_beta_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        AND NOT EXISTS (
            SELECT 1
            FROM public.hack_beta_submissions AS existing
            WHERE LOWER(existing.wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
    );
