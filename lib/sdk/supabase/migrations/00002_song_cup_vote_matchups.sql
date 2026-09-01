-- Migration: Song Cup vote matchups + votes, second admin wallet
-- Apply in Supabase Dashboard → SQL Editor (idempotent).

-- 1. Add creative.eth admin wallet
INSERT INTO private.song_cup_admins (wallet_address)
VALUES ('0xa7383918cbd43a73d2391a09fdd429b832b2e2f6')
ON CONFLICT (wallet_address) DO NOTHING;

-- 2. Matchups curated by admins (head-to-head Orb posts)
CREATE TABLE IF NOT EXISTS public.song_cup_matchups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    left_orb_url TEXT NOT NULL,
    right_orb_url TEXT NOT NULL,
    left_post_id TEXT,
    right_post_id TEXT,
    left_label TEXT,
    right_label TEXT,
    status TEXT NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'active', 'past')),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_song_cup_matchups_status
    ON public.song_cup_matchups (status);

CREATE INDEX IF NOT EXISTS idx_song_cup_matchups_starts_at
    ON public.song_cup_matchups (starts_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS trg_song_cup_matchups_updated_at ON public.song_cup_matchups;

CREATE TRIGGER trg_song_cup_matchups_updated_at
    BEFORE UPDATE ON public.song_cup_matchups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3. Votes (one per wallet per matchup)
CREATE TABLE IF NOT EXISTS public.song_cup_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matchup_id UUID NOT NULL REFERENCES public.song_cup_matchups (id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    choice TEXT NOT NULL CHECK (choice IN ('left', 'right')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (matchup_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_song_cup_votes_matchup_id
    ON public.song_cup_votes (matchup_id);

-- 4. RLS
ALTER TABLE public.song_cup_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_cup_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_select_song_cup_matchups ON public.song_cup_matchups;
DROP POLICY IF EXISTS allow_insert_song_cup_matchups ON public.song_cup_matchups;
DROP POLICY IF EXISTS allow_update_song_cup_matchups ON public.song_cup_matchups;
DROP POLICY IF EXISTS allow_delete_song_cup_matchups ON public.song_cup_matchups;

CREATE POLICY allow_select_song_cup_matchups
    ON public.song_cup_matchups
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY allow_insert_song_cup_matchups
    ON public.song_cup_matchups
    FOR INSERT
    TO authenticated
    WITH CHECK (private.is_song_cup_admin());

CREATE POLICY allow_update_song_cup_matchups
    ON public.song_cup_matchups
    FOR UPDATE
    TO authenticated
    USING (private.is_song_cup_admin())
    WITH CHECK (private.is_song_cup_admin());

CREATE POLICY allow_delete_song_cup_matchups
    ON public.song_cup_matchups
    FOR DELETE
    TO authenticated
    USING (private.is_song_cup_admin());

DROP POLICY IF EXISTS allow_select_song_cup_votes ON public.song_cup_votes;
DROP POLICY IF EXISTS allow_insert_song_cup_votes ON public.song_cup_votes;

CREATE POLICY allow_select_song_cup_votes
    ON public.song_cup_votes
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY allow_insert_song_cup_votes
    ON public.song_cup_votes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
    );
