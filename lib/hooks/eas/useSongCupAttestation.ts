"use client";

import { useUploadAttestation } from "@/lib/hooks/eas/useUploadAttestation";
import { SONG_CUP_ATTESTATION_CONFIG } from "@/lib/songchain/song-cup/attestation-config";

export function useSongCupAttestation() {
  return useUploadAttestation(SONG_CUP_ATTESTATION_CONFIG);
}
