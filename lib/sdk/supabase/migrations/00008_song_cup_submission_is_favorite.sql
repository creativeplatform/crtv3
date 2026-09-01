-- Migration: Song Cup submission is_favorite flag (Hack Beta pattern)
-- Apply in Supabase Dashboard → SQL Editor (idempotent).

ALTER TABLE public.song_cup_submissions
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_song_cup_submissions_is_favorite
    ON public.song_cup_submissions (is_favorite);

-- Sync admin wallets from client config
INSERT INTO private.song_cup_admins (wallet_address)
VALUES
    ('0xde4b0371bba20602685916ceee5b22025a811734'),
    ('0xf00f94794ce5b989e751b9d229b2786fba8f6d63')
ON CONFLICT (wallet_address) DO NOTHING;

-- Backfill: prior approved submissions count as favorites
UPDATE public.song_cup_submissions
SET is_favorite = true
WHERE status = 'approved'
  AND is_favorite = false;
