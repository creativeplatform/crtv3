-- Enable RLS on source_1 table (Goldsky pipeline target)
-- This enforces that all interactions must go through policies (or be service_role)

ALTER TABLE public.source_1 ENABLE ROW LEVEL SECURITY;

-- Grant SELECT permission to anon and authenticated roles
-- This is required for the SELECT policy to function
GRANT SELECT ON public.source_1 TO anon, authenticated;

-- Revoke modification permissions from public roles to ensure they can't write
-- (Even without this, RLS would block them if no INSERT/UPDATE policies exist, 
-- but this provides an extra layer of security at the table privilege level)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.source_1 FROM anon, authenticated, public;

-- Create Policy 1: Allow public read access
-- "true" means any row is visible to anyone with SELECT permissions
DROP POLICY IF EXISTS "Enable read access for all users" ON public.source_1;
CREATE POLICY "Enable read access for all users" ON public.source_1
    FOR SELECT
    USING (true);

-- No policies are created for INSERT, UPDATE, or DELETE.
-- This intentionally adheres to the "Service Write Only" model.
-- The Supabase 'service_role' key bypasses RLS and can still write.
