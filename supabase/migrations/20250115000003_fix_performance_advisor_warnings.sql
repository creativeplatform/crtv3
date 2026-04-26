-- Fix Performance Advisor Warnings
-- This migration addresses:
-- 1. Auth RLS Initialization Plan warnings (8 warnings)
-- 2. Multiple Permissive Policies warnings (8 warnings)
--
-- Note: Unused Index suggestions (20 info items) should be reviewed manually
-- before dropping, as they may be needed for future queries or usage tracking
-- may not be complete yet.

-- ============================================================================
-- 1. CREATE HELPER FUNCTION FOR AUTH CONTEXT INITIALIZATION
-- ============================================================================
-- Supabase already provides auth.uid() and auth.email() which are optimized.
-- However, for smart account auth (using wallet addresses), we need a helper
-- that efficiently retrieves the address from JWT claims.
-- 
-- Note: We create this in the public schema since we don't have permission
-- to create functions in the auth schema.

-- Helper function to get wallet address from JWT (for smart account auth)
-- This optimizes RLS policies by calling current_setting once instead of
-- using auth.jwt() ->> 'address' multiple times
CREATE OR REPLACE FUNCTION get_wallet_address()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claim.address', true),
      current_setting('request.jwt.claim.sub', true)
    ),
    ''
  )::TEXT;
$$;

-- ============================================================================
-- 2. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

-- Fix comment_likes: Consolidate 4 permissive policies into 1
DROP POLICY IF EXISTS "Anyone can read comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Anyone can like comments" ON comment_likes;
DROP POLICY IF EXISTS "Public access for comment likes" ON comment_likes;

-- Create single consolidated policy for comment_likes
CREATE POLICY "Public access for comment likes"
  ON comment_likes
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- Fix video_assets: Consolidate multiple SELECT policies into 1
-- Note: The app uses service_role for writes, so we focus on optimizing SELECT policies
DROP POLICY IF EXISTS "Public read access for published video assets" ON video_assets;
DROP POLICY IF EXISTS "Anonymous read access for published video assets" ON video_assets;
DROP POLICY IF EXISTS "Creators can view their own video assets" ON video_assets;
DROP POLICY IF EXISTS "Public read access for video assets" ON video_assets;

-- Create single optimized SELECT policy
-- Note: We wrap current_setting() in (select ...) to ensure it's evaluated
-- once per query instead of once per row, as recommended by Supabase Performance Advisor
CREATE POLICY "Public read access for video assets"
  ON video_assets
  FOR SELECT
  USING (
    status IN ('published', 'minted') OR
    COALESCE(
      NULLIF((select current_setting('request.jwt.claim.address', true)), ''),
      NULLIF((select current_setting('request.jwt.claim.sub', true)), '')
    ) = creator_id
  );

-- Ensure service_role policies remain (these handle writes)
-- Note: If these don't exist, create them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'video_assets' 
    AND policyname = 'Service role can insert video assets'
  ) THEN
    CREATE POLICY "Service role can insert video assets" ON video_assets
      FOR INSERT 
      TO service_role
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'video_assets' 
    AND policyname = 'Service role can update video assets'
  ) THEN
    CREATE POLICY "Service role can update video assets" ON video_assets
      FOR UPDATE 
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'video_assets' 
    AND policyname = 'Service role can delete video assets'
  ) THEN
    CREATE POLICY "Service role can delete video assets" ON video_assets
      FOR DELETE 
      TO service_role
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 3. FIX REMAINING AUTH RLS INITIALIZATION PLAN WARNINGS
-- ============================================================================
-- Wrap all current_setting() and auth.jwt() calls in (select ...) subqueries
-- to ensure they're evaluated once per query instead of once per row.
-- This fixes the remaining 8 "Auth RLS Initialization Plan" warnings.

-- Fix metokens UPDATE policy
DROP POLICY IF EXISTS "Users can update their own metokens" ON metokens;
CREATE POLICY "Users can update their own metokens" ON metokens
  FOR UPDATE 
  USING (COALESCE(
    NULLIF((select current_setting('request.jwt.claim.address', true)), ''),
    NULLIF((select current_setting('request.jwt.claim.sub', true)), '')
  ) = owner_address);

-- Fix metoken_balances INSERT policy
DROP POLICY IF EXISTS "Users can insert their own balances" ON metoken_balances;
CREATE POLICY "Users can insert their own balances" ON metoken_balances
  FOR INSERT 
  WITH CHECK (COALESCE(
    NULLIF((select current_setting('request.jwt.claim.address', true)), ''),
    NULLIF((select current_setting('request.jwt.claim.sub', true)), '')
  ) = user_address);

-- Fix metoken_balances UPDATE policy
DROP POLICY IF EXISTS "Users can update their own balances" ON metoken_balances;
CREATE POLICY "Users can update their own balances" ON metoken_balances
  FOR UPDATE 
  USING (COALESCE(
    NULLIF((select current_setting('request.jwt.claim.address', true)), ''),
    NULLIF((select current_setting('request.jwt.claim.sub', true)), '')
  ) = user_address);

-- Fix metoken_transactions INSERT policy
DROP POLICY IF EXISTS "Users can insert their own transactions" ON metoken_transactions;
CREATE POLICY "Users can insert their own transactions" ON metoken_transactions
  FOR INSERT 
  WITH CHECK (COALESCE(
    NULLIF((select current_setting('request.jwt.claim.address', true)), ''),
    NULLIF((select current_setting('request.jwt.claim.sub', true)), '')
  ) = user_address);

-- Fix creator_profiles INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON creator_profiles;
CREATE POLICY "Users can insert their own profile" ON creator_profiles
  FOR INSERT 
  WITH CHECK (COALESCE(
    NULLIF((select current_setting('request.jwt.claim.address', true)), ''),
    NULLIF((select current_setting('request.jwt.claim.sub', true)), '')
  ) = owner_address);

-- Fix creator_profiles UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON creator_profiles;
CREATE POLICY "Users can update their own profile" ON creator_profiles
  FOR UPDATE 
  USING (COALESCE(
    NULLIF((select current_setting('request.jwt.claim.address', true)), ''),
    NULLIF((select current_setting('request.jwt.claim.sub', true)), '')
  ) = owner_address);

-- Fix creator_profiles DELETE policy
DROP POLICY IF EXISTS "Users can delete their own profile" ON creator_profiles;
CREATE POLICY "Users can delete their own profile" ON creator_profiles
  FOR DELETE 
  USING (COALESCE(
    NULLIF((select current_setting('request.jwt.claim.address', true)), ''),
    NULLIF((select current_setting('request.jwt.claim.sub', true)), '')
  ) = owner_address);

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_wallet_address() IS 'Helper function to get wallet address from JWT (for smart account auth). Optimizes RLS policies by calling current_setting once instead of parsing auth.jwt() multiple times. Created in public schema since we cannot create functions in auth schema.';

COMMENT ON POLICY "Public access for comment likes" ON comment_likes IS 'Consolidated policy replacing multiple permissive policies (SELECT, INSERT, UPDATE, DELETE) for better performance. All operations are permissive and authorization is handled in the service layer.';

COMMENT ON POLICY "Public read access for video assets" ON video_assets IS 'Consolidated SELECT policy replacing multiple permissive policies. Allows: (1) Public access to published/minted videos, (2) Creators access to their own videos. Improves performance by evaluating a single policy with OR conditions instead of multiple separate policies. Uses (select current_setting(...)) to evaluate auth context once per query instead of once per row.';

-- Comments for updated policies
COMMENT ON POLICY "Users can update their own metokens" ON metokens IS 'RLS policy using (select current_setting(...)) to evaluate auth context once per query instead of once per row, fixing Auth RLS Initialization Plan warning.';
COMMENT ON POLICY "Users can insert their own balances" ON metoken_balances IS 'RLS policy using (select current_setting(...)) to evaluate auth context once per query instead of once per row, fixing Auth RLS Initialization Plan warning.';
COMMENT ON POLICY "Users can update their own balances" ON metoken_balances IS 'RLS policy using (select current_setting(...)) to evaluate auth context once per query instead of once per row, fixing Auth RLS Initialization Plan warning.';
COMMENT ON POLICY "Users can insert their own transactions" ON metoken_transactions IS 'RLS policy using (select current_setting(...)) to evaluate auth context once per query instead of once per row, fixing Auth RLS Initialization Plan warning.';
COMMENT ON POLICY "Users can insert their own profile" ON creator_profiles IS 'RLS policy using (select current_setting(...)) to evaluate auth context once per query instead of once per row, fixing Auth RLS Initialization Plan warning.';
COMMENT ON POLICY "Users can update their own profile" ON creator_profiles IS 'RLS policy using (select current_setting(...)) to evaluate auth context once per query instead of once per row, fixing Auth RLS Initialization Plan warning.';
COMMENT ON POLICY "Users can delete their own profile" ON creator_profiles IS 'RLS policy using (select current_setting(...)) to evaluate auth context once per query instead of once per row, fixing Auth RLS Initialization Plan warning.';

