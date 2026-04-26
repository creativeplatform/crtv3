-- Stream moderation tables: hidden messages, banned users, moderator appointments.
-- Reads are public (so all clients can apply the same view filter); writes are
-- restricted to the service role (server actions perform creator/moderator auth checks).

-- 1) Hidden messages: per-stream, per-XMTP-message-id list.
CREATE TABLE IF NOT EXISTS public.stream_moderation_hidden_messages (
  stream_id text NOT NULL,
  message_id text NOT NULL,
  hidden_by text NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, message_id)
);

CREATE INDEX IF NOT EXISTS stream_moderation_hidden_messages_stream_id_idx
  ON public.stream_moderation_hidden_messages (stream_id);

ALTER TABLE public.stream_moderation_hidden_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read hidden messages" ON public.stream_moderation_hidden_messages;
CREATE POLICY "Public can read hidden messages"
  ON public.stream_moderation_hidden_messages
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policy: only service role (used by server actions) can write.

-- 2) Bans: per-stream, per-address blocklist.
CREATE TABLE IF NOT EXISTS public.stream_moderation_bans (
  stream_id text NOT NULL,
  banned_address text NOT NULL,
  banned_by text NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, banned_address)
);

CREATE INDEX IF NOT EXISTS stream_moderation_bans_stream_id_idx
  ON public.stream_moderation_bans (stream_id);

CREATE OR REPLACE FUNCTION public.stream_moderation_bans_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.banned_address := lower(NEW.banned_address);
  NEW.banned_by := lower(NEW.banned_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stream_moderation_bans_normalize_trigger
  ON public.stream_moderation_bans;
CREATE TRIGGER stream_moderation_bans_normalize_trigger
  BEFORE INSERT OR UPDATE
  ON public.stream_moderation_bans
  FOR EACH ROW
  EXECUTE FUNCTION public.stream_moderation_bans_normalize();

ALTER TABLE public.stream_moderation_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read bans" ON public.stream_moderation_bans;
CREATE POLICY "Public can read bans"
  ON public.stream_moderation_bans
  FOR SELECT
  USING (true);

-- 3) Moderators: per-stream addresses appointed by the creator.
CREATE TABLE IF NOT EXISTS public.stream_moderation_moderators (
  stream_id text NOT NULL,
  moderator_address text NOT NULL,
  appointed_by text NOT NULL,
  appointed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, moderator_address)
);

CREATE INDEX IF NOT EXISTS stream_moderation_moderators_stream_id_idx
  ON public.stream_moderation_moderators (stream_id);

CREATE INDEX IF NOT EXISTS stream_moderation_moderators_address_idx
  ON public.stream_moderation_moderators (moderator_address);

CREATE OR REPLACE FUNCTION public.stream_moderation_moderators_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.moderator_address := lower(NEW.moderator_address);
  NEW.appointed_by := lower(NEW.appointed_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stream_moderation_moderators_normalize_trigger
  ON public.stream_moderation_moderators;
CREATE TRIGGER stream_moderation_moderators_normalize_trigger
  BEFORE INSERT OR UPDATE
  ON public.stream_moderation_moderators
  FOR EACH ROW
  EXECUTE FUNCTION public.stream_moderation_moderators_normalize();

ALTER TABLE public.stream_moderation_moderators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read moderators" ON public.stream_moderation_moderators;
CREATE POLICY "Public can read moderators"
  ON public.stream_moderation_moderators
  FOR SELECT
  USING (true);
