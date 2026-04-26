-- Fix SECURITY DEFINER issue on metoken burn views
-- Recreates views with WITH (security_invoker=true) so they respect RLS.
--
-- Schema (verified against information_schema.columns):
--   metoken_burns(
--     vid bigint, block integer, id bytea, me_token bytea, asset bytea,
--     burner bytea, recipient bytea, me_tokens_burned numeric,
--     assets_returned numeric, block_number numeric, block_timestamp numeric,
--     transaction_hash bytea, _gs_chain text, _gs_gid text,
--     created_at timestamptz, updated_at timestamptz
--   )
--
-- Addresses are stored as bytea; we expose them as 0x-prefixed hex text so
-- consumers (and JOINs against metokens.address which is text) can match them.

-- metoken_burn_stats: one row per me_token aggregating burn counts/volume
DROP VIEW IF EXISTS public.metoken_burn_stats;

CREATE VIEW public.metoken_burn_stats
WITH (security_invoker = true) AS
SELECT
  ('0x' || encode(me_token, 'hex')) AS me_token,
  count(*)                          AS total_burns,
  count(DISTINCT burner)            AS unique_burners,
  min(block_timestamp)              AS first_burn_timestamp,
  max(block_timestamp)              AS last_burn_timestamp,
  max(created_at)                   AS last_synced_at
FROM public.metoken_burns
GROUP BY me_token;

-- recent_metoken_burns: denormalized burn feed joined to metokens
DROP VIEW IF EXISTS public.recent_metoken_burns;

CREATE VIEW public.recent_metoken_burns
WITH (security_invoker = true) AS
SELECT
  mb.id,
  ('0x' || encode(mb.me_token, 'hex'))         AS me_token,
  ('0x' || encode(mb.burner, 'hex'))           AS burner,
  ('0x' || encode(mb.recipient, 'hex'))        AS recipient,
  mb.me_tokens_burned,
  mb.assets_returned,
  mb.block_number,
  mb.block_timestamp,
  ('0x' || encode(mb.transaction_hash, 'hex')) AS transaction_hash,
  mb.created_at,
  mb.updated_at,
  mt.name                                      AS metoken_name,
  mt.symbol                                    AS metoken_symbol,
  mt.owner_address                             AS metoken_owner,
  to_timestamp(mb.block_timestamp::double precision) AS burn_timestamp
FROM public.metoken_burns mb
LEFT JOIN public.metokens mt
  ON lower(mt.address) = lower('0x' || encode(mb.me_token, 'hex'))
ORDER BY mb.block_timestamp DESC NULLS LAST, mb.created_at DESC;

GRANT SELECT ON public.metoken_burn_stats  TO anon, authenticated;
GRANT SELECT ON public.recent_metoken_burns TO anon, authenticated;
