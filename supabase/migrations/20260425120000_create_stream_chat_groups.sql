-- Maps XMTP conversation IDs to playback IDs (the moderation key) so the
-- server-side worker can resolve streamId from message.conversationId.
-- The host's browser inserts a row when it creates a chat group; the worker
-- (and the read-only admin tools) can look up by either column.

CREATE TABLE IF NOT EXISTS public.stream_chat_groups (
  group_id text PRIMARY KEY,
  stream_id text NOT NULL,
  bot_invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stream_chat_groups_stream_id_idx
  ON public.stream_chat_groups (stream_id);

ALTER TABLE public.stream_chat_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read chat group map" ON public.stream_chat_groups;
CREATE POLICY "Public can read chat group map"
  ON public.stream_chat_groups
  FOR SELECT
  USING (true);

-- Writes: service role only.
