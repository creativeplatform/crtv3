-- Store Lens "going live" root post id for live stream comment-chat (option B).
ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS lens_live_post_id text;

COMMENT ON COLUMN public.streams.lens_live_post_id IS
  'Lens post ID for the stream going-live announcement; live chat uses comments on this post.';
