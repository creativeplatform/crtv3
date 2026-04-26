-- Fix Function Search Path Security Issues
-- This migration sets explicit search_path for all functions to prevent schema manipulation attacks
-- Setting search_path = public, pg_temp ensures functions only access intended schemas

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix update_comment_replies_count function
CREATE OR REPLACE FUNCTION update_comment_replies_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    UPDATE video_comments
    SET replies_count = replies_count + 1,
        updated_at = NOW()
    WHERE id = NEW.parent_comment_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix update_comment_likes_count function
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE video_comments
    SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE video_comments
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Fix get_metoken_stats function
CREATE OR REPLACE FUNCTION get_metoken_stats(metoken_addr TEXT)
RETURNS TABLE (
  total_transactions BIGINT,
  unique_holders BIGINT,
  total_volume NUMERIC,
  avg_transaction_size NUMERIC
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(mt.id) as total_transactions,
    COUNT(DISTINCT mb.user_address) as unique_holders,
    COALESCE(SUM(CASE 
      WHEN mt.transaction_type IN ('mint', 'burn') THEN mt.collateral_amount 
      ELSE mt.amount 
    END), 0) as total_volume,
    CASE 
      WHEN COUNT(mt.id) > 0 THEN 
        COALESCE(SUM(CASE 
          WHEN mt.transaction_type IN ('mint', 'burn') THEN mt.collateral_amount 
          ELSE mt.amount 
        END), 0) / COUNT(mt.id)
      ELSE 0 
    END as avg_transaction_size
  FROM metoken_transactions mt
  LEFT JOIN metoken_balances mb ON mb.metoken_id = mt.metoken_id
  WHERE mt.metoken_id = (SELECT id FROM metokens WHERE address = metoken_addr);
END;
$$;

-- Fix search_metokens function
CREATE OR REPLACE FUNCTION search_metokens(search_query TEXT, result_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  address TEXT,
  owner_address TEXT,
  name TEXT,
  symbol TEXT,
  total_supply NUMERIC,
  tvl NUMERIC,
  hub_id INTEGER,
  balance_pooled NUMERIC,
  balance_locked NUMERIC,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  end_cooldown TIMESTAMP WITH TIME ZONE,
  target_hub_id INTEGER,
  migration_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  rank REAL
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.*,
    ts_rank(to_tsvector('english', m.name || ' ' || m.symbol), plainto_tsquery('english', search_query)) as rank
  FROM metokens m
  WHERE to_tsvector('english', m.name || ' ' || m.symbol) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, m.tvl DESC
  LIMIT result_limit;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function to automatically update updated_at timestamp. Security: search_path explicitly set to prevent schema manipulation.';
COMMENT ON FUNCTION update_comment_replies_count() IS 'Trigger function to update comment reply counts. Security: search_path explicitly set to prevent schema manipulation.';
COMMENT ON FUNCTION update_comment_likes_count() IS 'Trigger function to update comment like counts. Security: search_path explicitly set to prevent schema manipulation.';
COMMENT ON FUNCTION get_metoken_stats(TEXT) IS 'Get MeToken statistics. Security: search_path explicitly set to prevent schema manipulation.';
COMMENT ON FUNCTION search_metokens(TEXT, INTEGER) IS 'Search MeTokens by name or symbol. Security: search_path explicitly set to prevent schema manipulation.';

