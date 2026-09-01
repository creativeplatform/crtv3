-- Migration 00007: Add RLS policies and restrict function execution to silence security warnings and secure admin checks

-- 1. private.song_cup_admins
DROP POLICY IF EXISTS allow_all_to_service_role ON private.song_cup_admins;
CREATE POLICY allow_all_to_service_role ON private.song_cup_admins
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. private.hack_beta_admins
DROP POLICY IF EXISTS allow_all_to_service_role ON private.hack_beta_admins;
CREATE POLICY allow_all_to_service_role ON private.hack_beta_admins
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Revoke execution permissions on security definer functions from public roles and grant to authorized roles
REVOKE EXECUTE ON FUNCTION private.is_song_cup_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_song_cup_admin() TO service_role, anon, authenticated;

REVOKE EXECUTE ON FUNCTION private.is_hack_beta_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_hack_beta_admin() TO service_role, anon, authenticated;

-- 4. Mark functions as STABLE for performance/caching benefits
ALTER FUNCTION private.is_song_cup_admin() STABLE;
ALTER FUNCTION private.is_hack_beta_admin() STABLE;
