-- Fix video_comments RLS INSERT policy
-- This migration creates a secure INSERT policy that enforces ownership at the database level
-- Users can only create comments with their own wallet address (from JWT claims)
--
-- This migration consolidates multiple permissive INSERT policies into a single secure policy
-- to avoid performance issues and maintainability risks from overlapping policies.

-- Drop ALL existing INSERT policies to ensure we start with a clean slate
-- This prevents multiple permissive policies from coexisting
DROP POLICY IF EXISTS "Anyone can create comments" ON video_comments;
DROP POLICY IF EXISTS "Comments - insert own" ON video_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON video_comments;

-- Create single secure INSERT policy that verifies ownership
-- This is the ONLY INSERT policy for video_comments to avoid multiple permissive policy conflicts
-- Authenticated users can only create comments with their own wallet address
CREATE POLICY "Comments - insert own"
  ON video_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Verify commenter_address matches the authenticated user's wallet address
    LOWER(commenter_address) = LOWER(
      COALESCE(
        NULLIF((SELECT current_setting('request.jwt.claim.address', true)), ''),
        NULLIF((SELECT current_setting('request.jwt.claim.sub', true)), '')
      )
    )
    -- Ensure video_asset_id is provided (FK constraint will verify it exists)
    AND video_asset_id IS NOT NULL
    -- Ensure content is not empty (complements table constraint)
    AND LENGTH(TRIM(content)) > 0
  );

-- Add comment for documentation
COMMENT ON POLICY "Comments - insert own" ON video_comments IS 
  'Single INSERT policy for video_comments. Authenticated users can only create comments with their own wallet address (from JWT claims). Prevents users from creating comments claiming to be someone else. Uses (SELECT current_setting(...)) pattern for optimal performance. Consolidates multiple permissive policies into one to avoid performance degradation.';
