-- Pinata agent connection fields on creator_profiles.
-- After a creator deploys the Creative AI Digital Twin template on Pinata and
-- pastes their Pinata JWT once, the server exchanges it for the per-agent
-- gateway token (via GET /v0/agents/{agentId}/gateway-token) and persists the
-- routing details below. The JWT itself is never stored.
--
-- The gateway token is a per-agent credential that authenticates calls to the
-- agent's protected routes (POST <baseUrl>/chat etc.). It's restricted to
-- service-role access via RLS so client-side reads don't leak it.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS twin_pinata_agent_id text,
  ADD COLUMN IF NOT EXISTS twin_pinata_gateway_token text,
  ADD COLUMN IF NOT EXISTS twin_pinata_base_url text,
  ADD COLUMN IF NOT EXISTS twin_pinata_ws_url text,
  ADD COLUMN IF NOT EXISTS twin_pinata_snapshot_cid text,
  ADD COLUMN IF NOT EXISTS twin_pinata_agent_name text,
  ADD COLUMN IF NOT EXISTS twin_pinata_connected_at timestamptz;

CREATE INDEX IF NOT EXISTS creator_profiles_twin_pinata_agent_id_idx
  ON public.creator_profiles (twin_pinata_agent_id)
  WHERE twin_pinata_agent_id IS NOT NULL;

-- The gateway token is sensitive: scope SELECT/UPDATE on this column to the
-- service role only. This complements existing RLS by adding a column-level
-- grant restriction. Public/anon reads of other columns are unaffected.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'creator_profiles'
      AND column_name = 'twin_pinata_gateway_token'
  ) THEN
    REVOKE SELECT (twin_pinata_gateway_token) ON public.creator_profiles FROM anon, authenticated;
    REVOKE UPDATE (twin_pinata_gateway_token) ON public.creator_profiles FROM anon, authenticated;
  END IF;
END $$;
