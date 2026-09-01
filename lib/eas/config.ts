// EAS contract addresses on Base mainnet.
// Base Sepolia would use 0xC2679fBD37d54388Ce493B1f28e68Abe30Dbf7a0 (EAS) / 0x54E1F17593E072dB43D3FB5C4e4C2944b6C1F57C (SchemaRegistry)
export const EAS_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_EAS_CONTRACT_ADDRESS ||
  "0x4200000000000000000000000000000000000021";

export const EAS_SCHEMA_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_EAS_SCHEMA_REGISTRY_ADDRESS ||
  "0x4200000000000000000000000000000000000020";

// Schema UID must be set after registration via scripts/eas/register-upload-schema.ts
export const EAS_UPLOAD_SCHEMA_UID =
  process.env.NEXT_PUBLIC_EAS_UPLOAD_SCHEMA_UID || "";

export const UPLOAD_ATTESTATION_VERSION = "2.1.0";
export const UPLOAD_ATTESTATION_PLATFORM_NAME = "Creative TV";
export const UPLOAD_ATTESTATION_TERMS_URL =
  "https://creativeplatform.xyz/community/legal/terms-conditions";
export const UPLOAD_ATTESTATION_TERMS_VERSION = "2025.06.25";

/** Alchemy Gas Manager policy for sponsored EAS attestation UserOps on Base. */
export const DEFAULT_ATTESTATION_PAYMASTER_POLICY_ID =
  "be126055-1844-4b45-aa54-03c4993097c0";

// Schema records: attester identity, legal confirmations, source terms, and attestation versioning.
// Order matters for SchemaEncoder.encodeData.
export const EAS_UPLOAD_SCHEMA =
  "address attester, bool acceptedTerms, bool ownsCopyright, string platformName, string termsUrl, string termsVersion, uint64 timestamp, string version";
