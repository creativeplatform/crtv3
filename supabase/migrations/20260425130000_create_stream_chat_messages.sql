-- Persistent chat history per livestream session.
-- The XMTP group is ephemeral per session, but server-side moderation and
-- catch-up loading both need a durable record.
--
-- Reads are public (mirrors the chat itself); writes are restricted to the
-- service role, populated by a server-side XMTP worker (production) and the
-- host's browser as a fallback (when the worker isn't deployed or is down).

CREATE TABLE IF NOT EXISTS public.stream_chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id text NOT NULL,
  message_id text NOT NULL,
  sender_inbox_id text NOT NULL,
  content text NOT NULL,
  sent_at timestamptz NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  tip_data jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stream_chat_messages_stream_message_unique UNIQUE (stream_id, message_id)
);

CREATE INDEX IF NOT EXISTS stream_chat_messages_stream_sent_at_idx
  ON public.stream_chat_messages (stream_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS stream_chat_messages_sender_idx
  ON public.stream_chat_messages (stream_id, sender_inbox_id);

ALTER TABLE public.stream_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read chat history" ON public.stream_chat_messages;
CREATE POLICY "Public can read chat history"
  ON public.stream_chat_messages
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policy: only service role writes.
