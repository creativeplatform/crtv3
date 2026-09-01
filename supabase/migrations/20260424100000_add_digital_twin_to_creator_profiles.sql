-- Add Digital Twin fields to creator_profiles.
-- A creator can register an AI digital twin (an external agent identified by its EVM address)
-- that powers an on-stream avatar overlay and an optional Q&A chat panel.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS twin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS twin_address text,
  ADD COLUMN IF NOT EXISTS twin_avatar_glb_url text,
  ADD COLUMN IF NOT EXISTS twin_chat_endpoint text;

CREATE INDEX IF NOT EXISTS creator_profiles_twin_address_idx
  ON public.creator_profiles (twin_address)
  WHERE twin_address IS NOT NULL;
