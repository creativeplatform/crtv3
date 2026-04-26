-- Viewer-created clips from livestreams, mintable as Story Protocol derivative IPs.

alter table public.video_assets
  add column if not exists source_type text not null default 'Upload'
    check (source_type in ('Upload', 'Livestream', 'Clip')),
  add column if not exists parent_playback_id text,
  add column if not exists parent_story_ip_id text,
  add column if not exists clip_start_ms bigint,
  add column if not exists clip_end_ms bigint,
  add column if not exists clipper_address text;

create index if not exists video_assets_parent_playback_id_idx
  on public.video_assets (parent_playback_id);

create index if not exists video_assets_source_type_idx
  on public.video_assets (source_type);

alter table public.streams
  add column if not exists allow_clipping boolean not null default true,
  add column if not exists story_ip_id text,
  add column if not exists story_license_terms_id text,
  add column if not exists story_ip_registration_tx text,
  add column if not exists story_ip_registered_at timestamptz,
  add column if not exists story_commercial_rev_share integer check (story_commercial_rev_share is null or (story_commercial_rev_share >= 0 and story_commercial_rev_share <= 100));
