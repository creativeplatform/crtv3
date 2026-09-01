-- Search metadata for predictions + trigram indexes for case-insensitive autocomplete.
--
-- Requires public.video_assets and public.metokens (from earlier migrations).
-- Bootstraps public.prediction_market_creations if 20260505120000 was not applied yet.
--
-- Indexed columns are all `text` (no ::text casts required).
--
-- Autocomplete query patterns (RPC functions below use lower(col) ILIKE for index alignment):
--   video_assets:              lower(title|description) ILIKE '%' || lower(q) || '%'
--   prediction_market_creations: lower(title|category) ILIKE '%' || lower(q) || '%'
--   metokens:                  lower(name|symbol) ILIKE '%' || lower(q) || '%'
--
-- Trigram indexes use lower(column) gin_trgm_ops to align with ILIKE.
-- Partial indexes (WHERE col IS NOT NULL) skip null rows.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Base table (normally from 20260505120000_create_prediction_market_creations.sql).
-- Idempotent: safe when the table already exists with or without search columns.
CREATE TABLE IF NOT EXISTS public.prediction_market_creations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_address text NOT NULL,
  transaction_hash text NOT NULL,
  question_id text,
  title text,
  category text,
  question_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prediction_market_creations_tx_unique UNIQUE (transaction_hash),
  CONSTRAINT prediction_market_creations_address_lower CHECK (creator_address ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX IF NOT EXISTS idx_prediction_market_creations_address_created
  ON public.prediction_market_creations (lower(creator_address), created_at DESC);

COMMENT ON TABLE public.prediction_market_creations IS
  'Prediction markets created via Creative TV; used for monthly limits and autocomplete search.';

ALTER TABLE public.prediction_market_creations ENABLE ROW LEVEL SECURITY;

-- Add search columns when table was created by an older migration without them.
ALTER TABLE public.prediction_market_creations
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS question_type text;

-- Case-insensitive category lookups (lower(category) = 'songchain', category ILIKE, etc.)
CREATE INDEX IF NOT EXISTS idx_prediction_creations_category
  ON public.prediction_market_creations (lower(category))
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prediction_creations_title_trgm
  ON public.prediction_market_creations USING gin (lower(title) gin_trgm_ops)
  WHERE title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prediction_creations_category_trgm
  ON public.prediction_market_creations USING gin (lower(category) gin_trgm_ops)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_assets_title_trgm
  ON public.video_assets USING gin (lower(title) gin_trgm_ops)
  WHERE title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_assets_description_trgm
  ON public.video_assets USING gin (lower(description) gin_trgm_ops)
  WHERE description IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_metokens_name_trgm
  ON public.metokens USING gin (lower(name) gin_trgm_ops)
  WHERE name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_metokens_symbol_trgm
  ON public.metokens USING gin (lower(symbol) gin_trgm_ops)
  WHERE symbol IS NOT NULL;

ANALYZE public.prediction_market_creations;
ANALYZE public.video_assets;
ANALYZE public.metokens;

-- Autocomplete RPCs: lower(col) ILIKE matches gin (lower(col) gin_trgm_ops) indexes.
-- SECURITY INVOKER: callers need table SELECT + RLS policies (see policy below for predictions).
-- App search routes use service role (bypasses RLS); anon/authenticated grants support direct RPC use.
CREATE OR REPLACE FUNCTION public.autocomplete_video_assets(
  search_query text,
  result_limit integer DEFAULT 8
)
RETURNS TABLE (
  id integer,
  title text,
  thumbnail_url text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT va.id, va.title, va.thumbnail_url
  FROM public.video_assets AS va
  WHERE va.status IN ('published', 'minted')
    AND (
      lower(va.title) ILIKE '%' || lower(search_query) || '%'
      OR lower(va.description) ILIKE '%' || lower(search_query) || '%'
    )
  ORDER BY va.created_at DESC
  LIMIT GREATEST(result_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.autocomplete_prediction_creations(
  search_query text,
  result_limit integer DEFAULT 8
)
RETURNS TABLE (
  question_id text,
  title text,
  category text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT p.question_id, p.title, p.category
  FROM public.prediction_market_creations AS p
  WHERE p.question_id IS NOT NULL
    AND (
      lower(p.title) ILIKE '%' || lower(search_query) || '%'
      OR lower(p.category) ILIKE '%' || lower(search_query) || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT GREATEST(result_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.search_metokens_ilike(
  search_query text,
  result_limit integer DEFAULT 20
)
RETURNS SETOF public.metokens
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT m.*
  FROM public.metokens AS m
  WHERE lower(m.name) ILIKE '%' || lower(search_query) || '%'
     OR lower(m.symbol) ILIKE '%' || lower(search_query) || '%'
  ORDER BY m.tvl DESC NULLS LAST
  LIMIT GREATEST(result_limit, 1);
$$;

-- prediction_market_creations has RLS enabled with no prior SELECT policy (service-role writes only).
-- Public read for indexed rows so SECURITY INVOKER autocomplete works for anon/authenticated callers.
DROP POLICY IF EXISTS "Public read prediction market creations" ON public.prediction_market_creations;
CREATE POLICY "Public read prediction market creations"
  ON public.prediction_market_creations
  FOR SELECT
  USING (question_id IS NOT NULL);

GRANT EXECUTE ON FUNCTION public.autocomplete_video_assets(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.autocomplete_prediction_creations(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_metokens_ilike(text, integer) TO anon, authenticated, service_role;
