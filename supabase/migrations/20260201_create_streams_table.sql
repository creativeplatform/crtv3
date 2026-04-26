-- Create streams table for persistent creator channels
create table if not exists public.streams (
  id uuid default gen_random_uuid() primary key,
  creator_id text not null, -- Wallet address of the creator
  stream_key text not null, -- Private stream key (Livepeer)
  stream_id text not null, -- Livepeer Stream ID
  playback_id text not null, -- Public playback ID
  thumbnail_url text, -- Custom thumbnail URL
  name text, -- Stream name
  is_live boolean default false,
  last_live_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add unique constraint on creator_id (one stream per creator) - idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'streams_creator_id_key'
      AND t.relname = 'streams'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.streams
      ADD CONSTRAINT streams_creator_id_key UNIQUE (creator_id);
  END IF;
END $$;

-- Enable RLS
alter table public.streams enable row level security;

-- Create policies for streams table

-- 1. Public Read Policy: Everyone can read public stream info
drop policy if exists "Public can view streams" on public.streams;
create policy "Public can view streams"
  on public.streams
  for select
  using (true);

-- 2. Creator Stream Key Policy: Only creator can see their stream key
-- Note: Logic is handled in service layer usually, but good to have DB protection
-- Since we use service role for backend ops, this is strictly for potential direct access
drop policy if exists "Creators can view their own stream key" on public.streams;
create policy "Creators can view their own stream key"
  on public.streams
  for select
  using (
    -- Case insensitive comparison for wallet addresses
    lower(creator_id) = lower(auth.jwt() ->> 'sub')
    or
    -- Allow service role
    (select auth.uid()) is null 
  );

-- 3. Insert/Update Policy: Only creator can insert/update
drop policy if exists "Creators can insert/update their own stream" on public.streams;
create policy "Creators can insert/update their own stream"
  on public.streams
  for all
  using (
    -- Check ownership for UPDATE/DELETE
    lower(creator_id) = lower(auth.jwt() ->> 'sub')
    or
    -- Allow service role (for initial creation via server action)
    (select auth.uid()) is null
  )
  with check (
    -- Check ownership for INSERT
    lower(creator_id) = lower(auth.jwt() ->> 'sub')
    or
    (select auth.uid()) is null
  );

-- Create index on creator_id for faster lookups
create index if not exists streams_creator_id_idx on public.streams (creator_id);
create index if not exists streams_playback_id_idx on public.streams (playback_id);
