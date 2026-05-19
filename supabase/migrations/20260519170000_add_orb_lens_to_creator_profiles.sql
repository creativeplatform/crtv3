-- Orb / Lens sovereign identity fields on creator_profiles
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS orb_account_id TEXT,
  ADD COLUMN IF NOT EXISTS lens_account_id TEXT,
  ADD COLUMN IF NOT EXISTS lens_handle TEXT,
  ADD COLUMN IF NOT EXISTS lens_avatar_uri TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS creator_profiles_orb_account_id_key
  ON public.creator_profiles (orb_account_id)
  WHERE orb_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS creator_profiles_lens_account_id_idx
  ON public.creator_profiles (lens_account_id)
  WHERE lens_account_id IS NOT NULL;

COMMENT ON COLUMN public.creator_profiles.orb_account_id IS 'Orb sovereign account id from QR sign-in';
COMMENT ON COLUMN public.creator_profiles.lens_account_id IS 'Lens account address linked via Orb';
COMMENT ON COLUMN public.creator_profiles.lens_handle IS 'Lens username/handle for display';
COMMENT ON COLUMN public.creator_profiles.lens_avatar_uri IS 'Lens profile picture URI (ipfs/lens)';
