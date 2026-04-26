-- Fix RLS security issue for video_assets table
-- This migration enables RLS and creates appropriate policies for the video_assets table

-- Enable Row Level Security on video_assets table
ALTER TABLE video_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for video_assets table

-- Policy 1: Anyone can view published video assets
DROP POLICY IF EXISTS "Public read access for published video assets" ON video_assets;
CREATE POLICY "Public read access for published video assets" ON video_assets
  FOR SELECT USING (status = 'published');

-- Policy 2: Creators can view their own video assets (all statuses)
DROP POLICY IF EXISTS "Creators can view their own video assets" ON video_assets;
CREATE POLICY "Creators can view their own video assets" ON video_assets
  FOR SELECT USING (auth.jwt() ->> 'sub' = creator_id);

-- Policy 3: Creators can insert their own video assets
DROP POLICY IF EXISTS "Creators can insert their own video assets" ON video_assets;
CREATE POLICY "Creators can insert their own video assets" ON video_assets
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = creator_id);

-- Policy 4: Creators can update their own video assets
DROP POLICY IF EXISTS "Creators can update their own video assets" ON video_assets;
CREATE POLICY "Creators can update their own video assets" ON video_assets
  FOR UPDATE USING (auth.jwt() ->> 'sub' = creator_id);

-- Policy 5: Creators can delete their own video assets
DROP POLICY IF EXISTS "Creators can delete their own video assets" ON video_assets;
CREATE POLICY "Creators can delete their own video assets" ON video_assets
  FOR DELETE USING (auth.jwt() ->> 'sub' = creator_id);

-- Add trigger for updated_at timestamp on video_assets
DROP TRIGGER IF EXISTS update_video_assets_updated_at ON video_assets;
CREATE TRIGGER update_video_assets_updated_at
  BEFORE UPDATE ON video_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create index for better performance on creator_id lookups
CREATE INDEX IF NOT EXISTS idx_video_assets_creator_id ON video_assets(creator_id);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_video_assets_status ON video_assets(status);

-- Create index for asset_id lookups
CREATE INDEX IF NOT EXISTS idx_video_assets_asset_id ON video_assets(asset_id);

-- Create index for playback_id lookups
CREATE INDEX IF NOT EXISTS idx_video_assets_playback_id ON video_assets(playback_id);

-- Create index for created_at for sorting
CREATE INDEX IF NOT EXISTS idx_video_assets_created_at ON video_assets(created_at DESC);

-- Create index for views_count for trending
CREATE INDEX IF NOT EXISTS idx_video_assets_views_count ON video_assets(views_count DESC);

-- Create index for likes_count for trending
CREATE INDEX IF NOT EXISTS idx_video_assets_likes_count ON video_assets(likes_count DESC);

-- Create composite index for status and created_at for published videos
CREATE INDEX IF NOT EXISTS idx_video_assets_published_created_at ON video_assets(status, created_at DESC) 
  WHERE status = 'published';

-- Create composite index for creator and status
CREATE INDEX IF NOT EXISTS idx_video_assets_creator_status ON video_assets(creator_id, status);

-- Grant necessary permissions
GRANT SELECT ON video_assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON video_assets TO authenticated;

-- Create a view for public video assets (published only)
CREATE OR REPLACE VIEW public_video_assets 
WITH (security_invoker=true) AS
SELECT 
  id,
  title,
  asset_id,
  category,
  location,
  playback_id,
  description,
  creator_id,
  status,
  thumbnail_url,
  duration,
  views_count,
  likes_count,
  is_minted,
  token_id,
  contract_address,
  minted_at,
  mint_transaction_hash,
  royalty_percentage,
  price,
  max_supply,
  current_supply,
  metadata_uri,
  attributes,
  created_at,
  updated_at
FROM video_assets
WHERE status = 'published';

-- Grant access to the public view
GRANT SELECT ON public_video_assets TO anon, authenticated;
