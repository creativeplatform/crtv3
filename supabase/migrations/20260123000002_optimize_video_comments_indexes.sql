-- Optimize indexes for video_comments RLS policy performance
-- The INSERT policy uses LOWER(commenter_address) for case-insensitive comparison
-- A functional index on LOWER(commenter_address) will improve policy evaluation performance

-- Ensure RLS is enabled (should already be enabled, but safe to run)
ALTER TABLE video_comments ENABLE ROW LEVEL SECURITY;

-- Create functional index for case-insensitive commenter_address lookups
-- This optimizes the RLS policy that uses LOWER(commenter_address) = LOWER(...)
CREATE INDEX IF NOT EXISTS idx_video_comments_commenter_lower 
  ON video_comments(LOWER(commenter_address));

-- Note: The existing idx_video_comments_video_asset index on video_asset_id
-- is already sufficient for the video_asset_id IS NOT NULL check in the policy

-- Add comment for documentation
COMMENT ON INDEX idx_video_comments_commenter_lower IS 
  'Functional index on LOWER(commenter_address) to optimize RLS INSERT policy performance. The policy uses case-insensitive comparison, so this index ensures fast policy evaluation.';
