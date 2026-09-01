-- Follow-up if 20260721140000 was already applied without GRANTs / lowercase CHECKs.
-- Safe to run even if the base migration was updated before first apply.

-- Recreate policies with explicit TO roles
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

REVOKE INSERT, UPDATE, DELETE ON public.campaign_stickers FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sticker_claims FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sticker_tips FROM anon, authenticated;

-- Tighten address CHECKs to lowercase (drop + add; existing mixed-case rows must be fixed first)
DO $$
BEGIN
  ALTER TABLE public.campaign_stickers DROP CONSTRAINT IF EXISTS campaign_stickers_address_lower;
  UPDATE public.campaign_stickers
    SET brand_address = lower(brand_address);
  ALTER TABLE public.campaign_stickers
    ADD CONSTRAINT campaign_stickers_address_lower CHECK (brand_address ~ '^0x[a-f0-9]{40}$');

  ALTER TABLE public.sticker_claims DROP CONSTRAINT IF EXISTS sticker_claims_wallet_lower;
  UPDATE public.sticker_claims
    SET wallet = lower(wallet);
  ALTER TABLE public.sticker_claims
    ADD CONSTRAINT sticker_claims_wallet_lower CHECK (wallet ~ '^0x[a-f0-9]{40}$');

  ALTER TABLE public.sticker_tips DROP CONSTRAINT IF EXISTS sticker_tips_wallet_lower;
  UPDATE public.sticker_tips
    SET wallet = lower(wallet);
  ALTER TABLE public.sticker_tips
    ADD CONSTRAINT sticker_tips_wallet_lower CHECK (wallet ~ '^0x[a-f0-9]{40}$');
END $$;
