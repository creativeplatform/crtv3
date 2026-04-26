-- Migration: Add splits support for revenue sharing among collaborators
-- This enables automatic revenue distribution using Splits.org contracts

-- Add splits_address column to video_assets table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_assets' 
    AND column_name = 'splits_address'
  ) THEN
    ALTER TABLE video_assets 
    ADD COLUMN splits_address TEXT;
    
    -- Create index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_video_assets_splits_address 
    ON video_assets(splits_address);
  END IF;
END $$;

-- Create video_collaborators table to store collaborator addresses and percentages
CREATE TABLE IF NOT EXISTS video_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id INTEGER NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  collaborator_address TEXT NOT NULL,
  share_percentage INTEGER NOT NULL, -- Stored as basis points (e.g., 5000 = 50%)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique collaborator per video
  CONSTRAINT video_collaborators_video_collaborator_unique UNIQUE (video_id, collaborator_address),
  
  -- Validate percentage is between 0 and 10000 (0% to 100%)
  CONSTRAINT video_collaborators_share_percentage_check 
    CHECK (share_percentage >= 0 AND share_percentage <= 10000)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_video_collaborators_video_id 
  ON video_collaborators(video_id);

CREATE INDEX IF NOT EXISTS idx_video_collaborators_collaborator_address 
  ON video_collaborators(collaborator_address);

-- Add RLS policies for video_collaborators
ALTER TABLE video_collaborators ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view collaborators for videos they own
DROP POLICY IF EXISTS "Users can view collaborators for their videos" ON video_collaborators;
CREATE POLICY "Users can view collaborators for their videos"
  ON video_collaborators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM video_assets 
      WHERE video_assets.id = video_collaborators.video_id 
      AND video_assets.creator_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Policy: Users can insert collaborators for their videos
DROP POLICY IF EXISTS "Users can insert collaborators for their videos" ON video_collaborators;
CREATE POLICY "Users can insert collaborators for their videos"
  ON video_collaborators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM video_assets 
      WHERE video_assets.id = video_collaborators.video_id 
      AND video_assets.creator_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Policy: Users can update collaborators for their videos
DROP POLICY IF EXISTS "Users can update collaborators for their videos" ON video_collaborators;
CREATE POLICY "Users can update collaborators for their videos"
  ON video_collaborators
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM video_assets 
      WHERE video_assets.id = video_collaborators.video_id 
      AND video_assets.creator_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Policy: Users can delete collaborators for their videos
DROP POLICY IF EXISTS "Users can delete collaborators for their videos" ON video_collaborators;
CREATE POLICY "Users can delete collaborators for their videos"
  ON video_collaborators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM video_assets 
      WHERE video_assets.id = video_collaborators.video_id 
      AND video_assets.creator_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Note: We use service role client for server-side operations to bypass RLS
-- since we're using smart account addresses that don't match Supabase JWT auth

