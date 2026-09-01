-- Migration: Hack Beta submissions, admins, and settings (mixtape URL)

CREATE TABLE IF NOT EXISTS public.hack_beta_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    video_asset_id TEXT NOT NULL,
    title TEXT,
    description TEXT,
    playback_id TEXT,
    thumbnail_url TEXT,
    grove_url TEXT,
    grove_hash TEXT,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hack_beta_submissions_wallet_unique
    ON public.hack_beta_submissions (LOWER(wallet_address));

CREATE INDEX IF NOT EXISTS idx_hack_beta_submissions_status
    ON public.hack_beta_submissions (status);

CREATE INDEX IF NOT EXISTS idx_hack_beta_submissions_video_asset_id
    ON public.hack_beta_submissions (video_asset_id);

CREATE INDEX IF NOT EXISTS idx_hack_beta_submissions_is_favorite
    ON public.hack_beta_submissions (is_favorite);

DROP TRIGGER IF EXISTS trg_hack_beta_submissions_updated_at
    ON public.hack_beta_submissions;

CREATE TRIGGER trg_hack_beta_submissions_updated_at
    BEFORE UPDATE ON public.hack_beta_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.hack_beta_admins (
    wallet_address TEXT PRIMARY KEY
);

ALTER TABLE private.hack_beta_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_to_service_role ON private.hack_beta_admins;
CREATE POLICY allow_all_to_service_role ON private.hack_beta_admins
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

INSERT INTO private.hack_beta_admins (wallet_address)
VALUES
    ('0xdE4b0371BBa20602685916ceeE5B22025a811734'),
    ('0x6aBAa01C84b8b962D197E8a62598fea3Cfe0c5AD')
ON CONFLICT (wallet_address) DO NOTHING;

CREATE OR REPLACE FUNCTION private.is_hack_beta_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = private, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM private.hack_beta_admins
        WHERE LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
    );
$$;

REVOKE EXECUTE ON FUNCTION private.is_hack_beta_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_hack_beta_admin() TO service_role, anon, authenticated;

ALTER TABLE public.hack_beta_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_select_hack_beta_submissions ON public.hack_beta_submissions;
DROP POLICY IF EXISTS allow_insert_hack_beta_submissions ON public.hack_beta_submissions;
DROP POLICY IF EXISTS allow_update_hack_beta_submissions ON public.hack_beta_submissions;

CREATE POLICY allow_select_hack_beta_submissions
    ON public.hack_beta_submissions
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'approved'
        OR (
            auth.uid() IS NOT NULL
            AND LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
        OR private.is_hack_beta_admin()
    );

CREATE POLICY allow_insert_hack_beta_submissions
    ON public.hack_beta_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        LOWER(wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        AND NOT EXISTS (
            SELECT 1
            FROM public.hack_beta_submissions AS existing
            WHERE LOWER(existing.wallet_address) = LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
        )
    );

CREATE POLICY allow_update_hack_beta_submissions
    ON public.hack_beta_submissions
    FOR UPDATE
    TO authenticated
    USING (private.is_hack_beta_admin())
    WITH CHECK (private.is_hack_beta_admin());

-- Singleton settings (mixtape playlist URL)
CREATE TABLE IF NOT EXISTS public.hack_beta_settings (
    id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
    mixtape_playlist_url TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT
);

INSERT INTO public.hack_beta_settings (id, mixtape_playlist_url)
VALUES ('default', NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.hack_beta_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_select_hack_beta_settings ON public.hack_beta_settings;
DROP POLICY IF EXISTS allow_update_hack_beta_settings ON public.hack_beta_settings;

CREATE POLICY allow_select_hack_beta_settings
    ON public.hack_beta_settings
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY allow_update_hack_beta_settings
    ON public.hack_beta_settings
    FOR UPDATE
    TO authenticated
    USING (private.is_hack_beta_admin())
    WITH CHECK (private.is_hack_beta_admin());
