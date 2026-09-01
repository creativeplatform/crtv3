-- Migration: create song_cup_submissions table with secure RLS
-- Stores every video uploaded through the Song Cup Grove/IPFS flow.

-- 1. Main table
CREATE TABLE IF NOT EXISTS public.song_cup_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    grove_url TEXT NOT NULL,
    grove_hash TEXT,
    title TEXT,
    description TEXT,
    post_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_song_cup_submissions_wallet_address
    ON public.song_cup_submissions (wallet_address);

CREATE INDEX IF NOT EXISTS idx_song_cup_submissions_post_id
    ON public.song_cup_submissions (post_id);

CREATE INDEX IF NOT EXISTS idx_song_cup_submissions_status
    ON public.song_cup_submissions (status);

-- 3. Auto-update updated_at (no SECURITY DEFINER needed)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_song_cup_submissions_updated_at
    ON public.song_cup_submissions;

CREATE TRIGGER trg_song_cup_submissions_updated_at
    BEFORE UPDATE ON public.song_cup_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 4. Private admin table + schema
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.song_cup_admins (
    wallet_address TEXT PRIMARY KEY
);

-- IMPORTANT: enable RLS on the private admin table so API keys can't read it.
-- No policies for anon/authenticated => deny by default.
ALTER TABLE private.song_cup_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_to_service_role ON private.song_cup_admins;
CREATE POLICY allow_all_to_service_role ON private.song_cup_admins
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Seed admin wallet (replace with real admin wallet if different)
INSERT INTO private.song_cup_admins (wallet_address)
VALUES ('0xdE4b0371BBa20602685916ceeE5B22025a811734')
ON CONFLICT (wallet_address) DO NOTHING;

-- 5. Admin check function (SAFE only if users cannot change app_metadata.wallet_address)
CREATE OR REPLACE FUNCTION private.is_song_cup_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = private, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM private.song_cup_admins
        WHERE LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
    );
$$;

REVOKE EXECUTE ON FUNCTION private.is_song_cup_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_song_cup_admin() TO service_role, anon, authenticated;

-- 6. Enable RLS on submissions
ALTER TABLE public.song_cup_submissions ENABLE ROW LEVEL SECURITY;

-- 7. Recreate policies cleanly
DROP POLICY IF EXISTS allow_select_song_cup_submissions ON public.song_cup_submissions;
DROP POLICY IF EXISTS allow_insert_song_cup_submissions ON public.song_cup_submissions;
DROP POLICY IF EXISTS allow_update_song_cup_submissions ON public.song_cup_submissions;

-- SELECT: public sees only approved; authenticated users also see their own rows; admins see everything
CREATE POLICY allow_select_song_cup_submissions
    ON public.song_cup_submissions
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'approved'
        OR (
            auth.uid() IS NOT NULL
            AND LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
        OR private.is_song_cup_admin()
    );

-- INSERT: authenticated-only. Wallet spoofing protection requires server enforcement / app_metadata write control.
CREATE POLICY allow_insert_song_cup_submissions
    ON public.song_cup_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        AND NOT EXISTS (
            SELECT 1
            FROM public.song_cup_submissions AS existing
            WHERE LOWER(existing.wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
    );

-- UPDATE: admins only
CREATE POLICY allow_update_song_cup_submissions
    ON public.song_cup_submissions
    FOR UPDATE
    TO authenticated
    USING (private.is_song_cup_admin())
    WITH CHECK (private.is_song_cup_admin());
