-- Fix RLS performance issue for creator_collections table
-- Replace direct auth.uid() and current_setting() calls with scalar subqueries
-- to prevent per-row evaluation and improve query performance

-- Drop existing policies
DROP POLICY IF EXISTS "Creators can view their own collections" ON public.creator_collections;
DROP POLICY IF EXISTS "Creators can insert their own collections" ON public.creator_collections;
DROP POLICY IF EXISTS "Creators can update their own collections" ON public.creator_collections;

-- Recreate policies with optimized scalar subqueries
-- Using (SELECT auth.uid()) and (SELECT current_setting(...)) ensures
-- these functions are evaluated once per statement, not per row

-- SELECT policy: Creators can view their own collections
CREATE POLICY "Creators can view their own collections" ON public.creator_collections
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.uid())::text = creator_id) 
    OR 
    (creator_id = (((SELECT current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)))
  );

-- INSERT policy: Creators can insert their own collections
CREATE POLICY "Creators can insert their own collections" ON public.creator_collections
  FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid())::text = creator_id) 
    OR 
    (creator_id = (((SELECT current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)))
  );

-- UPDATE policy: Creators can update their own collections
CREATE POLICY "Creators can update their own collections" ON public.creator_collections
  FOR UPDATE TO authenticated
  USING (
    ((SELECT auth.uid())::text = creator_id) 
    OR 
    (creator_id = (((SELECT current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)))
  );

-- Note: Index idx_creator_collections_creator_id already exists
-- This index supports efficient filtering by creator_id in the RLS policies

