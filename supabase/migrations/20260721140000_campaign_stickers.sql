-- Campaign stickers registry, claims, and tip ledger for HeartBit engagement.
-- Access model: public SELECT via Data API; all writes via service-role API routes.

CREATE TABLE IF NOT EXISTS public.campaign_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id bigint NOT NULL,
  proposal_id text NOT NULL,
  ipfs_hash text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  brand_address text NOT NULL,
  name text,
  image_uri text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_stickers_token_unique UNIQUE (token_id),
  -- Canonical lowercase eth address
  CONSTRAINT campaign_stickers_address_lower CHECK (brand_address ~ '^0x[a-f0-9]{40}$')
);

CREATE INDEX IF NOT EXISTS idx_campaign_stickers_proposal
  ON public.campaign_stickers (proposal_id);

CREATE INDEX IF NOT EXISTS idx_campaign_stickers_brand
  ON public.campaign_stickers (brand_address);

CREATE TABLE IF NOT EXISTS public.sticker_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id bigint NOT NULL,
  wallet text NOT NULL,
  tx_hash text,
  vp numeric,
  choice text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sticker_claims_wallet_token_unique UNIQUE (token_id, wallet),
  CONSTRAINT sticker_claims_wallet_lower CHECK (wallet ~ '^0x[a-f0-9]{40}$')
);

CREATE INDEX IF NOT EXISTS idx_sticker_claims_wallet
  ON public.sticker_claims (wallet);

CREATE TABLE IF NOT EXISTS public.sticker_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  wallet text NOT NULL,
  sticker_token_id bigint,
  sticker_ipfs_hash text,
  composite_hash text NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  usdc_amount numeric NOT NULL DEFAULT 0,
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sticker_tips_wallet_lower CHECK (wallet ~ '^0x[a-f0-9]{40}$')
);

CREATE INDEX IF NOT EXISTS idx_sticker_tips_video
  ON public.sticker_tips (video_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sticker_tips_composite
  ON public.sticker_tips (composite_hash);

COMMENT ON TABLE public.campaign_stickers IS 'ERC-1155 campaign stickers created via CampaignStickers.createSticker';
COMMENT ON TABLE public.sticker_claims IS 'Snapshot-verified sticker claims';
COMMENT ON TABLE public.sticker_tips IS 'Public hold-to-tip ledger (HeartBit composites + USDC); fully public reads';

ALTER TABLE public.campaign_stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_tips ENABLE ROW LEVEL SECURITY;

-- Public read for anon + authenticated; no INSERT/UPDATE/DELETE grants for clients.
-- Writes use the service role (bypasses RLS) from Next.js API routes.
DROP POLICY IF EXISTS campaign_stickers_select_all ON public.campaign_stickers;
CREATE POLICY campaign_stickers_select_all
  ON public.campaign_stickers
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS sticker_claims_select_all ON public.sticker_claims;
CREATE POLICY sticker_claims_select_all
  ON public.sticker_claims
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS sticker_tips_select_all ON public.sticker_tips;
CREATE POLICY sticker_tips_select_all
  ON public.sticker_tips
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.campaign_stickers TO anon, authenticated;
GRANT SELECT ON public.sticker_claims TO anon, authenticated;
GRANT SELECT ON public.sticker_tips TO anon, authenticated;

-- Explicitly revoke client writes (service_role retains full access)
REVOKE INSERT, UPDATE, DELETE ON public.campaign_stickers FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sticker_claims FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sticker_tips FROM anon, authenticated;
