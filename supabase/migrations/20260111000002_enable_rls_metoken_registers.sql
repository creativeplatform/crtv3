-- Enable Row Level Security on metoken_registers table
-- This table contains public blockchain event data synced from Goldsky pipeline
-- Public read access is appropriate since this is public blockchain data

-- Enable RLS on metoken_registers table
ALTER TABLE public.metoken_registers ENABLE ROW LEVEL SECURITY;

-- Allow public read access to metoken_registers
-- This is blockchain event data, so it's safe to allow public read access
-- Writes come from the Goldsky pipeline (service_role), which bypasses RLS
DROP POLICY IF EXISTS "Allow public read access to metoken_registers" ON public.metoken_registers;
CREATE POLICY "Allow public read access to metoken_registers"
  ON public.metoken_registers
  FOR SELECT
  TO public
  USING (true);
