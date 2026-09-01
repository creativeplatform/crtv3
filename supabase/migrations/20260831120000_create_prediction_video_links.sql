-- Links Reality.eth prediction markets to Creative TV videos.
-- Written via service role only (app/api/predictions/record + GET hydrate helpers).
-- Pattern follows video_comments (20250115000001) and prediction_market_creations (20260505120000).
--
-- question_id is the on-chain Reality.eth question ID (bytes32 hex, lowercase).
-- video_asset_id references video_assets(id) (Supabase serial PK), NOT the Livepeer
-- asset UUID — the API resolves the Livepeer UUID -> PK server-side so clients
-- never need to know the internal integer.
-- Separate table (not a column on prediction_market_creations) because the record
-- route skips the quota insert for admin/premium creators; the link must still be
-- written for them or video strips would silently miss their markets.

CREATE TABLE IF NOT EXISTS public.prediction_video_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id text NOT NULL,
  video_asset_id integer NOT NULL REFERENCES public.video_assets(id) ON DELETE CASCADE,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prediction_video_links_question_unique UNIQUE (question_id),
  CONSTRAINT prediction_video_links_address_lower CHECK (created_by ~ '^0x[a-f0-9]{40}$')
);

-- Fast lookup for the video strip: all links for one video, newest first.
CREATE INDEX IF NOT EXISTS idx_prediction_video_links_video_created
  ON public.prediction_video_links (video_asset_id, created_at DESC);

-- Reverse lookup: which video a market belongs to (detail pages, dedupe checks).
CREATE INDEX IF NOT EXISTS idx_prediction_video_links_question
  ON public.prediction_video_links (question_id);

COMMENT ON TABLE public.prediction_video_links IS 'Maps Reality.eth prediction markets (question_id) to Creative TV video assets; powers video-page prediction strips.';
COMMENT ON COLUMN public.prediction_video_links.question_id IS 'Reality.eth on-chain question ID (bytes32 hex, lowercase). Unique — one market links to exactly one video.';
COMMENT ON COLUMN public.prediction_video_links.created_by IS 'Lowercase wallet address of the market creator who linked it (matches authenticated address on the record route).';

-- RLS: public read (strips must render for anonymous viewers, matching /predict pages),
-- writes restricted to service role (no INSERT/UPDATE/DELETE policies — supabaseService bypasses RLS).
ALTER TABLE public.prediction_video_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read prediction video links" ON public.prediction_video_links;
CREATE POLICY "Anyone can read prediction video links"
  ON public.prediction_video_links
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

GRANT SELECT ON public.prediction_video_links TO anon, authenticated;
GRANT ALL ON public.prediction_video_links TO service_role;

-- Defense-in-depth: RLS already blocks client writes (no INSERT/UPDATE/DELETE policies).
REVOKE INSERT, UPDATE, DELETE ON public.prediction_video_links FROM anon, authenticated;