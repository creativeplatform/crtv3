-- Fix RLS performance issue for streams table
-- Replace direct auth.jwt() calls with scalar subqueries
-- to prevent per-row evaluation and improve query performance.
-- Split FOR ALL into explicit INSERT and UPDATE/DELETE policies for clarity and least privilege.
-- Normalize creator_id to lowercase on write so policies can use direct equality and the
-- existing creator_id index; no functional index needed.

-- Drop existing policies that use auth
DROP POLICY IF EXISTS "Creators can view their own stream key" ON public.streams;
DROP POLICY IF EXISTS "Creators can insert/update their own stream" ON public.streams;

-- Remove functional index if it was created by an earlier version of this migration
DROP INDEX IF EXISTS streams_creator_id_lower_idx;

-- Normalize creator_id on write (trigger); then policies use creator_id = scalar
CREATE OR REPLACE FUNCTION public.streams_normalize_creator_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.creator_id := lower(NEW.creator_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS streams_normalize_creator_id_trigger ON public.streams;
CREATE TRIGGER streams_normalize_creator_id_trigger
  BEFORE INSERT OR UPDATE OF creator_id
  ON public.streams
  FOR EACH ROW
  EXECUTE FUNCTION public.streams_normalize_creator_id();

COMMENT ON FUNCTION public.streams_normalize_creator_id() IS
  'Normalizes creator_id to lowercase on insert/update so RLS policies can use direct equality (creator_id = lower(jwt sub)) and the existing creator_id index; avoids need for a functional index on lower(creator_id).';

-- Backfill: normalize existing rows (idempotent).
-- Caveat: if two rows differ only by case (e.g. 0xAb and 0xab), the UPDATE will violate
-- the unique constraint on creator_id. In that case deduplicate first (decide which row
-- to keep or merge), then run this migration again.
UPDATE public.streams
SET creator_id = lower(creator_id)
WHERE creator_id <> lower(creator_id);

-- Recreate policies: TO authenticated only; no IS NULL (service_role bypasses RLS for server ops).
-- Scalar subqueries: (SELECT auth.jwt()) evaluated once per statement; index on creator_id used.
DROP POLICY IF EXISTS "Creators can view their own stream key" ON public.streams;
CREATE POLICY "Creators can view their own stream key"
  ON public.streams
  FOR SELECT
  TO authenticated
  USING (creator_id = lower((SELECT auth.jwt()) ->> 'sub'));

DROP POLICY IF EXISTS "Creators can insert their own stream" ON public.streams;
CREATE POLICY "Creators can insert their own stream"
  ON public.streams
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = lower((SELECT auth.jwt()) ->> 'sub'));

DROP POLICY IF EXISTS "Creators can update their own stream" ON public.streams;
CREATE POLICY "Creators can update their own stream"
  ON public.streams
  FOR UPDATE
  TO authenticated
  USING (creator_id = lower((SELECT auth.jwt()) ->> 'sub'))
  WITH CHECK (creator_id = lower((SELECT auth.jwt()) ->> 'sub'));

DROP POLICY IF EXISTS "Creators can delete their own stream" ON public.streams;
CREATE POLICY "Creators can delete their own stream"
  ON public.streams
  FOR DELETE
  TO authenticated
  USING (creator_id = lower((SELECT auth.jwt()) ->> 'sub'));
