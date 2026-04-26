-- Fix video_assets RLS for Smart Account addresses
-- 
-- CONTEXT:
-- The application uses Account Kit smart accounts (EIP-4337) for authentication.
-- Smart account addresses are stored in creator_id, but these don't match Supabase JWT user IDs.
-- 
-- SOLUTION:
-- Server-side operations use the service role key to bypass RLS.
-- This migration updates policies to be more permissive while maintaining security.

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Creators can insert their own video assets" ON video_assets;

-- Idempotent: remote may already have these policies from a prior apply
DROP POLICY IF EXISTS "Service role can insert video assets" ON video_assets;

-- Create a new policy that allows service role to insert
-- (Service role operations bypass RLS anyway, but this documents intent)
CREATE POLICY "Service role can insert video assets" ON video_assets
  FOR INSERT 
  TO service_role
  WITH CHECK (true);

-- Allow authenticated users to read all published videos (already exists but ensuring it's there)
DROP POLICY IF EXISTS "Public read access for published video assets" ON video_assets;
CREATE POLICY "Public read access for published video assets" ON video_assets
  FOR SELECT 
  USING (status = 'published' OR status = 'minted');

-- Allow anyone (including anonymous) to read published videos for discovery
DROP POLICY IF EXISTS "Anonymous read access for published video assets" ON video_assets;
CREATE POLICY "Anonymous read access for published video assets" ON video_assets
  FOR SELECT 
  TO anon
  USING (status = 'published' OR status = 'minted');

-- Update the UPDATE policy to allow service role
DROP POLICY IF EXISTS "Creators can update their own video assets" ON video_assets;
DROP POLICY IF EXISTS "Service role can update video assets" ON video_assets;
CREATE POLICY "Service role can update video assets" ON video_assets
  FOR UPDATE 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Keep the DELETE policy restrictive (only service role)
DROP POLICY IF EXISTS "Creators can delete their own video assets" ON video_assets;
DROP POLICY IF EXISTS "Service role can delete video assets" ON video_assets;
CREATE POLICY "Service role can delete video assets" ON video_assets
  FOR DELETE 
  TO service_role
  USING (true);

-- Add comments to document the smart account approach
COMMENT ON TABLE video_assets IS 'Video assets table - uses Account Kit smart accounts. Write operations require service role key.';
COMMENT ON COLUMN video_assets.creator_id IS 'Smart account address (not Supabase user ID) - this is the users EIP-4337 smart contract wallet address';

-- Create an index on creator_id for performance (already exists but ensuring)
CREATE INDEX IF NOT EXISTS idx_video_assets_creator_id ON video_assets(creator_id);

-- Grant necessary permissions
GRANT SELECT ON video_assets TO anon, authenticated;
GRANT ALL ON video_assets TO service_role;

