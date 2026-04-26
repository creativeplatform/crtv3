-- Fix RLS performance issue for video_collaborators table
-- Replace direct current_setting() calls with scalar subqueries
-- to prevent per-row evaluation and improve query performance

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view collaborators for their videos" ON public.video_collaborators;
DROP POLICY IF EXISTS "Users can insert collaborators for their videos" ON public.video_collaborators;
DROP POLICY IF EXISTS "Users can update collaborators for their videos" ON public.video_collaborators;
DROP POLICY IF EXISTS "Users can delete collaborators for their videos" ON public.video_collaborators;

-- Recreate policies with optimized scalar subqueries
-- Using (SELECT current_setting(...)) ensures the function is evaluated
-- once per statement, not per row

-- SELECT policy: Users can view collaborators for their videos
CREATE POLICY "Users can view collaborators for their videos" ON public.video_collaborators
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM video_assets
      WHERE video_assets.id = video_collaborators.video_id
        AND video_assets.creator_id = (((SELECT current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))
    )
  );

-- INSERT policy: Users can insert collaborators for their videos
CREATE POLICY "Users can insert collaborators for their videos" ON public.video_collaborators
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM video_assets
      WHERE video_assets.id = video_collaborators.video_id
        AND video_assets.creator_id = (((SELECT current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))
    )
  );

-- UPDATE policy: Users can update collaborators for their videos
CREATE POLICY "Users can update collaborators for their videos" ON public.video_collaborators
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM video_assets
      WHERE video_assets.id = video_collaborators.video_id
        AND video_assets.creator_id = (((SELECT current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))
    )
  );

-- DELETE policy: Users can delete collaborators for their videos
CREATE POLICY "Users can delete collaborators for their videos" ON public.video_collaborators
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM video_assets
      WHERE video_assets.id = video_collaborators.video_id
        AND video_assets.creator_id = (((SELECT current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))
    )
  );

