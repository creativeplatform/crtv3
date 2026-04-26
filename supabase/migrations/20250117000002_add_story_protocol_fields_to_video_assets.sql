-- Add Story Protocol fields to video_assets table
-- This migration adds fields to track IP Asset registration on Story Protocol

ALTER TABLE video_assets
ADD COLUMN IF NOT EXISTS story_ip_registered BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE video_assets
ADD COLUMN IF NOT EXISTS story_ip_id TEXT NULL;

ALTER TABLE video_assets
ADD COLUMN IF NOT EXISTS story_ip_registration_tx TEXT NULL;

ALTER TABLE video_assets
ADD COLUMN IF NOT EXISTS story_ip_registered_at TIMESTAMP WITH TIME ZONE NULL;

ALTER TABLE video_assets
ADD COLUMN IF NOT EXISTS story_license_terms_id TEXT NULL;

ALTER TABLE video_assets
ADD COLUMN IF NOT EXISTS story_license_template_id TEXT NULL;

-- Add index for faster queries by Story IP registration status
CREATE INDEX IF NOT EXISTS idx_video_assets_story_ip_registered 
  ON video_assets(story_ip_registered) 
  WHERE story_ip_registered = TRUE;

-- Add index for IP ID lookups
CREATE INDEX IF NOT EXISTS idx_video_assets_story_ip_id 
  ON video_assets(story_ip_id) 
  WHERE story_ip_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN video_assets.story_ip_registered IS 'Whether this video has been registered as an IP Asset on Story Protocol';
COMMENT ON COLUMN video_assets.story_ip_id IS 'Story Protocol IP Asset ID (ipId) - unique identifier for the IP Asset on Story';
COMMENT ON COLUMN video_assets.story_ip_registration_tx IS 'Transaction hash of the IP Asset registration on Story Protocol';
COMMENT ON COLUMN video_assets.story_ip_registered_at IS 'Timestamp when the IP Asset was registered on Story Protocol';
COMMENT ON COLUMN video_assets.story_license_terms_id IS 'ID of the license terms attached to this IP Asset (if any)';
COMMENT ON COLUMN video_assets.story_license_template_id IS 'ID of the license template used for this IP Asset (if any)';

