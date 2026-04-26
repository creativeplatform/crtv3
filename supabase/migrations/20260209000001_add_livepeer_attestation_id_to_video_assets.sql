-- Add Livepeer Verifiable Video attestation id to video_assets
ALTER TABLE video_assets
ADD COLUMN IF NOT EXISTS livepeer_attestation_id text;

COMMENT ON COLUMN video_assets.livepeer_attestation_id IS 'Livepeer attestation id from the Verifiable Video API (creator attestation for this video on IPFS)';

CREATE INDEX IF NOT EXISTS idx_video_assets_livepeer_attestation_id
  ON video_assets(livepeer_attestation_id)
  WHERE livepeer_attestation_id IS NOT NULL;
