-- Add full-text search capabilities to video_assets table
-- This migration adds tsvector columns and indexes for fast text search

-- Required before gin_trgm_ops indexes (Supabase: enable in Dashboard or here)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add tsvector column for full-text search
ALTER TABLE video_assets 
ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'C')
) STORED;

-- Create GIN index for full-text search (very fast for text queries)
CREATE INDEX IF NOT EXISTS idx_video_assets_search_vector 
ON video_assets USING GIN (search_vector);

-- Create additional text search indexes for ILIKE queries (fallback)
CREATE INDEX IF NOT EXISTS idx_video_assets_title_search 
ON video_assets USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_video_assets_description_search 
ON video_assets USING gin (description gin_trgm_ops);

-- Create a helper function for text search
CREATE OR REPLACE FUNCTION search_video_assets(
  search_query text,
  result_limit integer DEFAULT 20,
  result_offset integer DEFAULT 0
)
RETURNS TABLE (
  id integer,
  title text,
  asset_id text,
  category text,
  location text,
  playback_id text,
  description text,
  creator_id text,
  status text,
  thumbnail_url text,
  duration integer,
  views_count integer,
  likes_count integer,
  is_minted boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  rank real
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    va.id,
    va.title,
    va.asset_id,
    va.category,
    va.location,
    va.playback_id,
    va.description,
    va.creator_id,
    va.status,
    va.thumbnail_url,
    va.duration,
    va.views_count,
    va.likes_count,
    va.is_minted,
    va.created_at,
    va.updated_at,
    ts_rank(va.search_vector, websearch_to_tsquery('english', search_query)) as rank
  FROM video_assets va
  WHERE 
    va.status = 'published'
    AND va.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC, va.created_at DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;

-- Add comment for documentation
COMMENT ON COLUMN video_assets.search_vector IS 'Full-text search vector combining title (weight A), description (weight B), and category (weight C) for fast text search';
COMMENT ON FUNCTION search_video_assets IS 'Helper function for full-text search on video assets. Uses websearch_to_tsquery for natural language queries.';

-- Grant execute permission on the search function
GRANT EXECUTE ON FUNCTION search_video_assets TO anon, authenticated;

