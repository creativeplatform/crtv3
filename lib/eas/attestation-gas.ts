import { DEFAULT_ATTESTATION_PAYMASTER_POLICY_ID } from "@/lib/eas/config";

const POLICY_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type AttestationGasContext = {
  paymasterService?: { policyId: string };
};

export function stripEnvQuotes(value?: string): string | undefined {
  const trimmed = value?.replace(/^["']|["']$/g, "").trim();
  return trimmed || undefined;
}

/**
 * Resolve Alchemy Gas Manager policy for EAS attestation UserOps on Base.
 * Priority: dedicated attestation env → explicit config → repo default → general paymaster env.
 */
export function resolveAttestationPaymasterPolicyId(explicitPolicyId?: string): string | undefined {
  const candidates = [
    stripEnvQuotes(process.env.NEXT_PUBLIC_ATTESTATION_SPONSORED_POLICY_ID),
    stripEnvQuotes(explicitPolicyId),
    DEFAULT_ATTESTATION_PAYMASTER_POLICY_ID,
    stripEnvQuotes(process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID),
  ];

  for (const id of candidates) {
    if (id && POLICY_UUID.test(id)) {
      return id;
    }
  }
  return undefined;
}

export function buildSponsoredAttestationGasContext(explicitPolicyId?: string): {
  context: AttestationGasContext | undefined;
  isSponsored: boolean;
  policyId?: string;
} {
  const policyId = resolveAttestationPaymasterPolicyId(explicitPolicyId);
  if (!policyId) {
    return { context: undefined, isSponsored: false };
  }
  return {
    context: { paymasterService: { policyId } },
    isSponsored: true,
    policyId,
  };
}

export function isValidPaymasterPolicyId(policyId?: string): boolean {
  return !!policyId && POLICY_UUID.test(policyId);
}
