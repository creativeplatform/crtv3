import { stripEnvQuotes } from '@/lib/eas/attestation-gas';

const POLICY_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type MeTokenGasContext = {
  paymasterService?: { policyId: string };
};

export type MeTokenCreationGasResult = {
  context: MeTokenGasContext | undefined;
  isSponsored: boolean;
  policyId?: string;
};

function isValidPolicyId(policyId?: string): policyId is string {
  return !!policyId && POLICY_UUID.test(policyId);
}

/**
 * ETH-sponsored Alchemy Gas Manager policy for MeToken creation on Base.
 * Same policy for all users — NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID.
 * Does not use the USDC any-token policy.
 */
export function resolveMeTokenPaymasterPolicyId(): string | undefined {
  const policy = stripEnvQuotes(process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID);
  if (isValidPolicyId(policy)) return policy;
  return undefined;
}

export function buildMeTokenCreationGasContext(): MeTokenCreationGasResult {
  const policyId = resolveMeTokenPaymasterPolicyId();
  if (!policyId) {
    return { context: undefined, isSponsored: false };
  }

  return {
    context: { paymasterService: { policyId } },
    isSponsored: true,
    policyId,
  };
}

/** Alchemy paymaster policies expire sponsored UserOps after ~10 minutes. */
export const METOKEN_PAYMASTER_EXPIRY_MS = 10 * 60 * 1000;

export function formatMeTokenCreationError(params: {
  message: string;
  policyId?: string;
  userOpHash?: string;
  txHash?: string;
}): string {
  const lines = [params.message];

  if (params.policyId) {
    lines.push(`Paymaster policy: ${params.policyId}`);
  }
  if (params.userOpHash) {
    lines.push(`UserOp: ${params.userOpHash}`);
  }
  if (params.txHash) {
    lines.push(`Transaction: https://basescan.org/tx/${params.txHash}`);
  }

  lines.push(
    'Sponsored operations expire after about 10 minutes. If this keeps failing, try creating with 0 initial deposit.'
  );

  return lines.join('\n');
}
