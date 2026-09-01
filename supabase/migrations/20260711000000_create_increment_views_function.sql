-- Create increment_video_views function
-- This function atomically increments the views_count of a video asset
-- and returns the new count. It is defined as SECURITY DEFINER with
-- search_path set to public, pg_temp to ensure security.

CREATE OR REPLACE FUNCTION increment_video_views(p_playback_id TEXT)
RETURNS INT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE video_assets
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE playback_id = p_playback_id
  RETURNING views_count INTO new_count;
  RETURN new_count;
END;
$$;

COMMENT ON FUNCTION increment_video_views(TEXT) IS 'Atomically increment the views_count of a video asset. Security: search_path explicitly set to prevent schema manipulation.';
