-- Add indexes for market queries optimization
-- This migration adds indexes to improve performance of market page queries

-- Index for metokens created_at (for sorting by creation date)
CREATE INDEX IF NOT EXISTS idx_metokens_created_at ON metokens(created_at DESC);

-- Index for video_assets content_coin_id (for filtering content coins)
-- Note: content_coin_id is stored in attributes JSONB, so we'll create a GIN index
CREATE INDEX IF NOT EXISTS idx_video_assets_content_coin_id 
ON video_assets USING GIN ((attributes->'content_coin_id'));

-- Index for video_assets with content_coin_id and status (for published content coins)
CREATE INDEX IF NOT EXISTS idx_video_assets_content_coin_published 
ON video_assets(status, (attributes->'content_coin_id')) 
WHERE status = 'published' AND (attributes->'content_coin_id') IS NOT NULL;

-- Index for metoken_transactions created_at (for price history queries)
CREATE INDEX IF NOT EXISTS idx_metoken_transactions_created_at 
ON metoken_transactions(created_at DESC);

-- Composite index for metoken_transactions queries (metoken_id + created_at)
CREATE INDEX IF NOT EXISTS idx_metoken_transactions_metoken_created 
ON metoken_transactions(metoken_id, created_at DESC);

-- Index for metoken_transactions transaction_type (for filtering mint/burn)
CREATE INDEX IF NOT EXISTS idx_metoken_transactions_type 
ON metoken_transactions(transaction_type);

