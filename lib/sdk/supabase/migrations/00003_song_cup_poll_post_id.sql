-- Migration: Link Song Cup matchups to Orb Lens poll posts
-- Apply in Supabase Dashboard → SQL Editor (idempotent).

ALTER TABLE public.song_cup_matchups
    ADD COLUMN IF NOT EXISTS poll_post_id TEXT;

CREATE INDEX IF NOT EXISTS idx_song_cup_matchups_poll_post_id
    ON public.song_cup_matchups (poll_post_id)
    WHERE poll_post_id IS NOT NULL;
