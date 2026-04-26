-- Create video_comments table for persistent comment system on video uploads
-- This is separate from live chat which uses XMTP for ephemeral messaging

CREATE TABLE IF NOT EXISTS video_comments (
  id SERIAL PRIMARY KEY,
  video_asset_id INTEGER NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  parent_comment_id INTEGER NULL REFERENCES video_comments(id) ON DELETE CASCADE,
  commenter_address TEXT NOT NULL, -- Wallet address of commenter
  content TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  replies_count INTEGER NOT NULL DEFAULT 0,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_content CHECK (LENGTH(TRIM(content)) > 0 AND LENGTH(content) <= 2000),
  CONSTRAINT valid_parent CHECK (
    parent_comment_id IS NULL OR 
    (parent_comment_id IS NOT NULL AND parent_comment_id != id)
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_comments_video_asset ON video_comments(video_asset_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_video_comments_parent ON video_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_video_comments_created_at ON video_comments(created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_video_comments_commenter ON video_comments(commenter_address);

-- Create comment_likes table for tracking who liked which comments
CREATE TABLE IF NOT EXISTS comment_likes (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES video_comments(id) ON DELETE CASCADE,
  liker_address TEXT NOT NULL, -- Wallet address of person who liked
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one like per user per comment
  UNIQUE(comment_id, liker_address)
);

-- Index for comment_likes
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_liker ON comment_likes(liker_address);

-- Function to update replies_count when a reply is added
CREATE OR REPLACE FUNCTION update_comment_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    UPDATE video_comments
    SET replies_count = replies_count + 1,
        updated_at = NOW()
    WHERE id = NEW.parent_comment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update replies_count
DROP TRIGGER IF EXISTS trigger_update_replies_count ON video_comments;
CREATE TRIGGER trigger_update_replies_count
  AFTER INSERT ON video_comments
  FOR EACH ROW
  WHEN (NEW.parent_comment_id IS NOT NULL)
  EXECUTE FUNCTION update_comment_replies_count();

-- Function to update likes_count when a like is added/removed
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE video_comments
    SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE video_comments
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update likes_count
DROP TRIGGER IF EXISTS trigger_update_likes_count ON comment_likes;
CREATE TRIGGER trigger_update_likes_count
  AFTER INSERT OR DELETE ON comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_likes_count();

-- RLS Policies
ALTER TABLE video_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read non-deleted comments
DROP POLICY IF EXISTS "Anyone can read non-deleted comments" ON video_comments;
CREATE POLICY "Anyone can read non-deleted comments"
  ON video_comments
  FOR SELECT
  USING (is_deleted = FALSE);

-- Policy: Anyone can create comments
DROP POLICY IF EXISTS "Anyone can create comments" ON video_comments;
CREATE POLICY "Anyone can create comments"
  ON video_comments
  FOR INSERT
  WITH CHECK (TRUE);

-- Policy: Anyone can update comments (authorization handled in service layer)
-- The service layer verifies ownership before allowing updates
DROP POLICY IF EXISTS "Anyone can update comments" ON video_comments;
CREATE POLICY "Anyone can update comments"
  ON video_comments
  FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

-- Policy: Anyone can read comment likes
DROP POLICY IF EXISTS "Anyone can read comment likes" ON comment_likes;
CREATE POLICY "Anyone can read comment likes"
  ON comment_likes
  FOR SELECT
  USING (TRUE);

-- Policy: Anyone can like/unlike comments
DROP POLICY IF EXISTS "Anyone can like comments" ON comment_likes;
CREATE POLICY "Anyone can like comments"
  ON comment_likes
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- Comments for documentation
COMMENT ON TABLE video_comments IS 'Persistent comments on video uploads (separate from live chat)';
COMMENT ON COLUMN video_comments.parent_comment_id IS 'If set, this is a reply to another comment (enables threading)';
COMMENT ON COLUMN video_comments.commenter_address IS 'Wallet address of the person who made the comment';
COMMENT ON COLUMN video_comments.is_deleted IS 'Soft delete flag - comment is hidden but not removed from database';


