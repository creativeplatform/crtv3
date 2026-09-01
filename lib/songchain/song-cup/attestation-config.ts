import { UPLOAD_ATTESTATION_VERSION, DEFAULT_ATTESTATION_PAYMASTER_POLICY_ID } from "@/lib/eas/config";
import type { AttestationTermsConfig } from "@/lib/hooks/eas/useUploadAttestation";

/** On-chain terms reference for Song Cup contest submissions. */
export const SONG_CUP_ATTESTATION_TERMS_URL =
  process.env.NEXT_PUBLIC_SONG_CUP_TERMS_URL ?? "https://creativeplatform.xyz/songchain/song-cup#contest-terms";

export const SONG_CUP_ATTESTATION_TERMS_VERSION = "2026.07.01";
export const SONG_CUP_ATTESTATION_PLATFORM_NAME = "Song Cup";

/** Alchemy Gas Manager policy for gas-free Song Cup attestation on Base. */
export const SONG_CUP_ATTESTATION_PAYMASTER_POLICY_ID = DEFAULT_ATTESTATION_PAYMASTER_POLICY_ID;

export const SONG_CUP_ATTESTATION_CONFIG: AttestationTermsConfig = {
  platformName: SONG_CUP_ATTESTATION_PLATFORM_NAME,
  termsUrl: SONG_CUP_ATTESTATION_TERMS_URL,
  termsVersion: SONG_CUP_ATTESTATION_TERMS_VERSION,
  attestationVersion: UPLOAD_ATTESTATION_VERSION,
  paymasterPolicyId: SONG_CUP_ATTESTATION_PAYMASTER_POLICY_ID,
};
