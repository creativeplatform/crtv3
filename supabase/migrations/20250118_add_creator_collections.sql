-- Migration: Add creator_collections table for Story Protocol NFT collections
-- Each creator gets their own NFT collection address on Story Protocol

-- Create creator_collections table
CREATE TABLE IF NOT EXISTS creator_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  collection_address TEXT NOT NULL UNIQUE,
  collection_name TEXT NOT NULL,
  collection_symbol TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for fast lookups
  CONSTRAINT creator_collections_creator_id_key UNIQUE (creator_id)
);

-- Create index on creator_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_creator_collections_creator_id ON creator_collections(creator_id);

-- Create index on collection_address for reverse lookups
CREATE INDEX IF NOT EXISTS idx_creator_collections_collection_address ON creator_collections(collection_address);

-- Add collection_address column to video_assets if it doesn't exist
-- This links videos to their Story Protocol collection
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_assets' 
    AND column_name = 'story_collection_address'
  ) THEN
    ALTER TABLE video_assets 
    ADD COLUMN story_collection_address TEXT;
    
    -- Create index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_video_assets_story_collection_address 
    ON video_assets(story_collection_address);
  END IF;
END $$;

-- Add RLS policies for creator_collections
ALTER TABLE creator_collections ENABLE ROW LEVEL SECURITY;

-- Policy: Creators can view their own collections
DROP POLICY IF EXISTS "Creators can view their own collections" ON creator_collections;
CREATE POLICY "Creators can view their own collections"
  ON creator_collections
  FOR SELECT
  USING (auth.uid()::text = creator_id OR creator_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policy: Creators can insert their own collections
DROP POLICY IF EXISTS "Creators can insert their own collections" ON creator_collections;
CREATE POLICY "Creators can insert their own collections"
  ON creator_collections
  FOR INSERT
  WITH CHECK (auth.uid()::text = creator_id OR creator_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policy: Creators can update their own collections
DROP POLICY IF EXISTS "Creators can update their own collections" ON creator_collections;
CREATE POLICY "Creators can update their own collections"
  ON creator_collections
  FOR UPDATE
  USING (auth.uid()::text = creator_id OR creator_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Note: We use service role client for server-side operations to bypass RLS
-- since we're using smart account addresses that don't match Supabase JWT auth

