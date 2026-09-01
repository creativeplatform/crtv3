-- Store outcome labels for Creative TV-created prediction markets (display + search).

ALTER TABLE public.prediction_market_creations
  ADD COLUMN IF NOT EXISTS outcomes jsonb;

COMMENT ON COLUMN public.prediction_market_creations.outcomes IS
  'Human-readable outcome labels for select-type prediction markets.';
