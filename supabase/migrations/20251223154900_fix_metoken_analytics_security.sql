-- Fix security definer issue on metoken views and functions
-- This migration changes all views and functions from SECURITY DEFINER to SECURITY INVOKER
-- to ensure they respect RLS policies of the querying user

-- Fix functions first (since views might depend on them)

-- Fix get_metoken_stats function
CREATE OR REPLACE FUNCTION get_metoken_stats(metoken_addr TEXT)
RETURNS TABLE (
  total_transactions BIGINT,
  unique_holders BIGINT,
  total_volume NUMERIC,
  avg_transaction_size NUMERIC
) 
SECURITY INVOKER
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
$$ LANGUAGE plpgsql;

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
SECURITY INVOKER
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
$$ LANGUAGE plpgsql;

-- Fix metoken_analytics view
DROP VIEW IF EXISTS metoken_analytics;

CREATE OR REPLACE VIEW metoken_analytics 
WITH (security_invoker=true) AS
SELECT 
  m.id,
  m.address,
  m.name,
  m.symbol,
  m.owner_address,
  m.tvl,
  m.total_supply,
  m.created_at,
  COUNT(DISTINCT mb.user_address) as unique_holders,
  COUNT(mt.id) as total_transactions,
  COALESCE(SUM(CASE 
    WHEN mt.transaction_type IN ('mint', 'burn') THEN mt.collateral_amount 
    ELSE mt.amount 
  END), 0) as total_volume,
  COALESCE(AVG(CASE 
    WHEN mt.transaction_type IN ('mint', 'burn') THEN mt.collateral_amount 
    ELSE mt.amount 
  END), 0) as avg_transaction_size
FROM metokens m
LEFT JOIN metoken_balances mb ON mb.metoken_id = m.id AND mb.balance > 0
LEFT JOIN metoken_transactions mt ON mt.metoken_id = m.id
GROUP BY m.id, m.address, m.name, m.symbol, m.owner_address, m.tvl, m.total_supply, m.created_at
ORDER BY m.tvl DESC;

-- Fix metoken_overview view
DROP VIEW IF EXISTS metoken_overview;

CREATE OR REPLACE VIEW metoken_overview 
WITH (security_invoker=true) AS
SELECT 
  m.*,
  cp.username as creator_username,
  cp.avatar_url as creator_avatar,
  (m.balance_pooled + m.balance_locked) as total_liquidity,
  COUNT(DISTINCT mb.user_address) as holder_count
FROM metokens m
LEFT JOIN creator_profiles cp ON m.owner_address = cp.owner_address
LEFT JOIN metoken_balances mb ON m.id = mb.metoken_id
GROUP BY m.id, cp.username, cp.avatar_url;

-- Fix metoken_trading_activity view
DROP VIEW IF EXISTS metoken_trading_activity;

CREATE OR REPLACE VIEW metoken_trading_activity 
WITH (security_invoker=true) AS
SELECT 
  m.address as metoken_address,
  m.name as metoken_name,
  m.symbol as metoken_symbol,
  COUNT(mt.id) as total_transactions,
  SUM(mt.amount) as total_volume,
  COUNT(DISTINCT mt.user_address) as unique_traders,
  MAX(mt.created_at) as last_activity
FROM metokens m
LEFT JOIN metoken_transactions mt ON m.id = mt.metoken_id
WHERE mt.transaction_type IN ('mint', 'burn', 'transfer')
GROUP BY m.id, m.address, m.name, m.symbol;

