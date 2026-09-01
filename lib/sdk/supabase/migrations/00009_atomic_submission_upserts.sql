-- Migration 00009: atomic upsert RPC for hack beta and song cup submissions
--
-- NOTE (2026-07-30): Client submits no longer call these RPCs. Wallet users
-- authenticate via signed headers and POST to /api/hack-beta/submit and
-- /api/song-cup/submit, which upsert with the service-role client.
-- Kept for reference / optional PostgREST use with a real Supabase Auth JWT.
--
-- Replaces the client-side SELECT / UPDATE / INSERT race with a single Postgres
-- call. The real logic lives in private.* (SECURITY DEFINER) and is exposed via
-- thin public.* wrappers (SECURITY INVOKER) so PostgREST can reach them without
-- leaving a privileged function in the exposed public schema.

CREATE SCHEMA IF NOT EXISTS private;

-- Real upsert logic for hack beta submissions (private, SECURITY DEFINER).
CREATE OR REPLACE FUNCTION private.upsert_hack_beta_submission(
    p_video_asset_id TEXT,
    p_title TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_playback_id TEXT DEFAULT NULL,
    p_thumbnail_url TEXT DEFAULT NULL,
    p_grove_url TEXT DEFAULT NULL,
    p_grove_hash TEXT DEFAULT NULL
)
RETURNS public.hack_beta_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_wallet_address TEXT;
    v_result public.hack_beta_submissions;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    v_wallet_address := LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'));

    IF v_wallet_address IS NULL OR v_wallet_address = '' THEN
        RAISE EXCEPTION 'Wallet address not found in JWT app_metadata';
    END IF;

    UPDATE public.hack_beta_submissions
    SET
        video_asset_id = p_video_asset_id,
        title = p_title,
        description = p_description,
        playback_id = p_playback_id,
        thumbnail_url = p_thumbnail_url,
        grove_url = p_grove_url,
        grove_hash = p_grove_hash,
        status = 'pending',
        updated_at = now()
    WHERE LOWER(wallet_address) = v_wallet_address
    RETURNING * INTO v_result;

    IF FOUND THEN
        RETURN v_result;
    END IF;

    INSERT INTO public.hack_beta_submissions (
        wallet_address,
        video_asset_id,
        title,
        description,
        playback_id,
        thumbnail_url,
        grove_url,
        grove_hash,
        status,
        is_favorite
    ) VALUES (
        v_wallet_address,
        p_video_asset_id,
        p_title,
        p_description,
        p_playback_id,
        p_thumbnail_url,
        p_grove_url,
        p_grove_hash,
        'pending',
        false
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.upsert_hack_beta_submission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.upsert_hack_beta_submission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Thin public wrapper exposed to PostgREST / supabase-js.
CREATE OR REPLACE FUNCTION public.upsert_hack_beta_submission(
    p_video_asset_id TEXT,
    p_title TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_playback_id TEXT DEFAULT NULL,
    p_thumbnail_url TEXT DEFAULT NULL,
    p_grove_url TEXT DEFAULT NULL,
    p_grove_hash TEXT DEFAULT NULL
)
RETURNS public.hack_beta_submissions
LANGUAGE sql
SECURITY INVOKER
SET search_path = private
AS $$
    SELECT private.upsert_hack_beta_submission(
        p_video_asset_id,
        p_title,
        p_description,
        p_playback_id,
        p_thumbnail_url,
        p_grove_url,
        p_grove_hash
    );
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_hack_beta_submission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_hack_beta_submission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Real upsert logic for song cup submissions (private, SECURITY DEFINER).
CREATE OR REPLACE FUNCTION private.upsert_song_cup_submission(
    p_grove_url TEXT,
    p_grove_hash TEXT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_artist_handle TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_cover_url TEXT DEFAULT NULL,
    p_cover_hash TEXT DEFAULT NULL,
    p_attestation_uid TEXT DEFAULT NULL,
    p_post_id TEXT DEFAULT NULL
)
RETURNS public.song_cup_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_wallet_address TEXT;
    v_result public.song_cup_submissions;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    v_wallet_address := LOWER((auth.jwt() -> 'app_metadata' ->> 'wallet_address'));

    IF v_wallet_address IS NULL OR v_wallet_address = '' THEN
        RAISE EXCEPTION 'Wallet address not found in JWT app_metadata';
    END IF;

    UPDATE public.song_cup_submissions
    SET
        grove_url = p_grove_url,
        grove_hash = p_grove_hash,
        title = p_title,
        description = p_description,
        artist_handle = p_artist_handle,
        email = p_email,
        cover_url = p_cover_url,
        cover_hash = p_cover_hash,
        attestation_uid = p_attestation_uid,
        post_id = p_post_id,
        status = 'pending',
        updated_at = now()
    WHERE LOWER(wallet_address) = v_wallet_address
    RETURNING * INTO v_result;

    IF FOUND THEN
        RETURN v_result;
    END IF;

    INSERT INTO public.song_cup_submissions (
        wallet_address,
        grove_url,
        grove_hash,
        title,
        description,
        artist_handle,
        email,
        cover_url,
        cover_hash,
        attestation_uid,
        post_id,
        status,
        is_favorite
    ) VALUES (
        v_wallet_address,
        p_grove_url,
        p_grove_hash,
        p_title,
        p_description,
        p_artist_handle,
        p_email,
        p_cover_url,
        p_cover_hash,
        p_attestation_uid,
        p_post_id,
        'pending',
        false
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.upsert_song_cup_submission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.upsert_song_cup_submission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Thin public wrapper exposed to PostgREST / supabase-js.
CREATE OR REPLACE FUNCTION public.upsert_song_cup_submission(
    p_grove_url TEXT,
    p_grove_hash TEXT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_artist_handle TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_cover_url TEXT DEFAULT NULL,
    p_cover_hash TEXT DEFAULT NULL,
    p_attestation_uid TEXT DEFAULT NULL,
    p_post_id TEXT DEFAULT NULL
)
RETURNS public.song_cup_submissions
LANGUAGE sql
SECURITY INVOKER
SET search_path = private
AS $$
    SELECT private.upsert_song_cup_submission(
        p_grove_url,
        p_grove_hash,
        p_title,
        p_description,
        p_artist_handle,
        p_email,
        p_cover_url,
        p_cover_hash,
        p_attestation_uid,
        p_post_id
    );
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_song_cup_submission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_song_cup_submission(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
