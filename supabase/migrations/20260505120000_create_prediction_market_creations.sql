-- Tracks on-chain prediction market creations for monthly quotas (non–Investor/Brand members).
-- Written via service role from app/api/predictions/record only.

CREATE TABLE IF NOT EXISTS public.prediction_market_creations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_address text NOT NULL,
  transaction_hash text NOT NULL,
  question_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prediction_market_creations_tx_unique UNIQUE (transaction_hash),
  CONSTRAINT prediction_market_creations_address_lower CHECK (creator_address ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX IF NOT EXISTS idx_prediction_market_creations_address_created
  ON public.prediction_market_creations (lower(creator_address), created_at DESC);

COMMENT ON TABLE public.prediction_market_creations IS 'Prediction markets created via Creative TV; used for 3/month limit when user lacks Investor or Brand membership.';

ALTER TABLE public.prediction_market_creations ENABLE ROW LEVEL SECURITY;
