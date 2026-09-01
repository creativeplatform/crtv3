-- Add streamer-controlled recording toggle to streams table.
-- The boolean is intentionally NOT NULL with a TRUE default so all existing
-- channels keep recording replays and the application can rely on a real value.

ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS save_recording BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.streams.save_recording IS 'Whether Livepeer should record this stream and persist it to video_assets after the broadcast ends';

-- NOTE: A standalone index on a low-cardinality boolean is usually not useful.
-- We fetch streams by playback_id/creator_id and then read this flag, so no
-- index is added here. If a query pattern emerges that filters on this flag
-- (e.g. WHERE save_recording = FALSE AND creator_id = $1), add a composite or
-- partial index matching that exact shape.
