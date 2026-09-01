-- Add MeToken gating fields to streams table (mirrors video_assets semantics)

ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS requires_metoken BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS metoken_price DECIMAL(20, 8) NULL;

COMMENT ON COLUMN public.streams.requires_metoken IS 'Whether live playback requires holding the creator''s MeToken';
COMMENT ON COLUMN public.streams.metoken_price IS 'Minimum MeToken balance required to watch live playback (null if not required)';

CREATE INDEX IF NOT EXISTS idx_streams_requires_metoken
ON public.streams(requires_metoken)
WHERE requires_metoken = TRUE;
