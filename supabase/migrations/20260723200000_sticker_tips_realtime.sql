-- Enable Realtime fan-out for live tip overlays + live-updating tip ledger.
-- Postgres Changes enforces RLS per subscriber; sticker_tips already has public SELECT.

DO $$
BEGIN
  -- Hosted Supabase projects already have this publication; local/fresh DBs may not.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'sticker_tips'
  ) THEN
    RAISE EXCEPTION 'public.sticker_tips does not exist; run campaign stickers migrations first';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sticker_tips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sticker_tips;
  END IF;
END $$;
