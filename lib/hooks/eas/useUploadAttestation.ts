"use client";

import { useCallback, useEffect, useState } from "react";
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import {
  useAccount,
  useSmartAccountClient,
} from "@/lib/wallet/react";
import { useGasSponsorship } from "@/lib/hooks/wallet/useGasSponsorship";
import {
  EAS_CONTRACT_ADDRESS,
  EAS_UPLOAD_SCHEMA,
  EAS_UPLOAD_SCHEMA_UID,
  UPLOAD_ATTESTATION_PLATFORM_NAME,
  UPLOAD_ATTESTATION_TERMS_URL,
  UPLOAD_ATTESTATION_TERMS_VERSION,
  UPLOAD_ATTESTATION_VERSION,
} from "@/lib/eas/config";
import {
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  parseEther,
  type Address,
  http,
  createPublicClient,
} from "viem";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";
import { parseBundlerError } from "@/lib/utils/bundlerErrorParser";
import { base } from "viem/chains";
import { buildSponsoredAttestationGasContext } from "@/lib/eas/attestation-gas";

export type AttestationStatus =
  | "idle"
  | "checking"
  | "needsAttestation"
  | "signing"
  | "submitting"
  | "needsGas"
  | "success"
  | "error";

export interface GasRequirement {
  ethBalance: bigint;
  usdcBalance: bigint;
  minEth: bigint;
  minUsdc: bigint;
  scaAddress: `0x${string}`;
}

export interface AttestationTermsConfig {
  platformName: string;
  termsUrl: string;
  termsVersion: string;
  attestationVersion: string;
  /** Alchemy Gas Manager policy ID for sponsored attestation UserOps on Base. */
  paymasterPolicyId?: string;
}

interface UploadAttestation {
  uid: string;
  attester: string;
  acceptedTerms: boolean;
  ownsCopyright: boolean;
  platformName: string;
  termsUrl: string;
  termsVersion: string;
  timestamp: number;
  version: string;
  txHash?: string;
}

const DEFAULT_ATTESTATION_TERMS: AttestationTermsConfig = {
  platformName: UPLOAD_ATTESTATION_PLATFORM_NAME,
  termsUrl: UPLOAD_ATTESTATION_TERMS_URL,
  termsVersion: UPLOAD_ATTESTATION_TERMS_VERSION,
  attestationVersion: UPLOAD_ATTESTATION_VERSION,
};

function attestationMatchesTerms(
  attestation: UploadAttestation,
  terms: AttestationTermsConfig,
): boolean {
  return (
    attestation.termsVersion === terms.termsVersion &&
    attestation.termsUrl === terms.termsUrl &&
    attestation.platformName === terms.platformName
  );
}

const EAS_SUBGRAPH_URL = "https://base.easscan.org/graphql";

interface AttestationSubgraphNode {
  id: string;
  attester: { id: string };
  data: string;
  txHash: string;
}

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const MIN_ETH_FOR_GAS = parseEther("0.001");
const MIN_USDC_FOR_GAS = 5_000_000n; // $5 USDC (6 decimals) — paymaster usually needs a small buffer

/**
 * Build a Base public RPC client for gas-balance reads so we don't rely on the
 * Alchemy smart-account client exposing viem public actions. This fixes
 * "t.getBalance is not a function" when the underlying wallet client isn't
 * extended with publicActions.
 */
function getBasePublicClient() {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const transport = apiKey
    ? http(`https://base-mainnet.g.alchemy.com/v2/${apiKey}`)
    : http("https://mainnet.base.org");
  return createPublicClient({ chain: base, transport });
}

export function useUploadAttestation(termsConfig: AttestationTermsConfig = DEFAULT_ATTESTATION_TERMS) {
  const { address } = useAccount();
  const { client } = useSmartAccountClient({ type: "MultiOwnerModularAccount" });
  const { getAttestationGasContext, getGasContext } = useGasSponsorship();
  const [status, setStatus] = useState<AttestationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attestation, setAttestation] = useState<UploadAttestation | null>(null);
  const [gasRequirement, setGasRequirement] = useState<GasRequirement | null>(null);

  const clearGasRequirement = useCallback(() => {
  setGasRequirement(null);
  if (status === "needsGas") setStatus("needsAttestation");
  }, [status]);

  const decodeAttestation = useCallback((node: AttestationSubgraphNode): UploadAttestation | null => {
    try {
      const decoder = new SchemaEncoder(EAS_UPLOAD_SCHEMA);
      const decoded = decoder.decodeData(node.data);
      const getValue = (name: string) => decoded.find((d) => d.name === name)?.value.value;
      const result: UploadAttestation = {
        uid: node.id,
        attester: node.attester.id,
        acceptedTerms: Boolean(getValue("acceptedTerms")),
        ownsCopyright: Boolean(getValue("ownsCopyright")),
        platformName: String(getValue("platformName")),
        termsUrl: String(getValue("termsUrl")),
        termsVersion: String(getValue("termsVersion")),
        timestamp: Number(getValue("timestamp")),
        version: String(getValue("version")),
        txHash: node.txHash,
      };
      if (result.acceptedTerms && result.ownsCopyright) return result;
      return null;
    } catch (err) {
      logger.warn("Failed to decode attestation:", err);
      return null;
    }
  }, []);

  const fetchAttestation = useCallback(async (): Promise<UploadAttestation | null> => {
    if (!address || !EAS_UPLOAD_SCHEMA_UID) return null;

    const query = `
      query GetUploadAttestation($schema: String!, $attester: String!) {
        attestations(
          where: {
            schema: { equals: $schema }
            attester: { equals: $attester }
            revoked: { equals: false }
          }
          orderBy: { time: desc }
          first: 10
        ) {
          id
          attester { id }
          data
          txHash
        }
      }
    `;

    const res = await fetch(EAS_SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: {
          schema: EAS_UPLOAD_SCHEMA_UID.toLowerCase(),
          attester: address.toLowerCase(),
        },
      }),
    });

    const json = await res.json();
    const nodes = (json?.data?.attestations ?? []) as AttestationSubgraphNode[];
    for (const node of nodes) {
      const decoded = decodeAttestation(node);
      if (decoded && attestationMatchesTerms(decoded, termsConfig)) {
        return decoded;
      }
    }
    return null;
  }, [address, decodeAttestation, termsConfig]);

  const checkAttestation = useCallback(async () => {
    if (!address) {
      setStatus("idle");
      return null;
    }
    if (!EAS_UPLOAD_SCHEMA_UID) {
      setError("EAS schema UID is not configured");
      setStatus("error");
      return null;
    }

    setStatus("checking");
    setError(null);

    try {
      const found = await fetchAttestation();
      if (found) {
        setAttestation(found);
        setStatus("success");
        return found;
      }
      setAttestation(null);
      setStatus("needsAttestation");
      return null;
    } catch (err) {
      logger.error("Failed to check upload attestation:", err);
      setError(err instanceof Error ? err.message : "Failed to verify attestation");
      setStatus("error");
      return null;
    }
  }, [address, fetchAttestation]);

  const fetchGasBalances = useCallback(async (scaAddress: `0x${string}`): Promise<{ ethBalance: bigint; usdcBalance: bigint }> => {
    const publicClient = getBasePublicClient();
    const [ethBalance, usdcBalanceRaw] = await Promise.all([
      publicClient.getBalance({ address: scaAddress }),
      publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [scaAddress],
      }) as Promise<bigint>,
    ]);
    return { ethBalance, usdcBalance: usdcBalanceRaw };
  }, []);

  const setNeedsGas = useCallback((
    scaAddress: `0x${string}`,
    ethBalance: bigint,
    usdcBalance: bigint,
  ) => {
    setGasRequirement({
      ethBalance,
      usdcBalance,
      minEth: MIN_ETH_FOR_GAS,
      minUsdc: MIN_USDC_FOR_GAS,
      scaAddress,
    });
    setStatus("needsGas");
    setError(null);
  }, []);

  const signAttestation = useCallback(async () => {
    if (!address || !client) {
      toast.error("Wallet not ready");
      return null;
    }
    if (!EAS_UPLOAD_SCHEMA_UID) {
      toast.error("EAS schema UID is not configured");
      return null;
    }

    setStatus("signing");
    setError(null);
    setGasRequirement(null);

    try {
      const encoder = new SchemaEncoder(EAS_UPLOAD_SCHEMA);
      const timestamp = BigInt(Math.floor(Date.now() / 1000));
      const encoded = encoder.encodeData([
        { name: "attester", value: address as `0x${string}`, type: "address" },
        { name: "acceptedTerms", value: true, type: "bool" },
        { name: "ownsCopyright", value: true, type: "bool" },
        { name: "platformName", value: termsConfig.platformName, type: "string" },
        { name: "termsUrl", value: termsConfig.termsUrl, type: "string" },
        { name: "termsVersion", value: termsConfig.termsVersion, type: "string" },
        { name: "timestamp", value: timestamp, type: "uint64" },
        { name: "version", value: termsConfig.attestationVersion, type: "string" },
      ]) as `0x${string}`;

      let { context, isSponsored, policyId: attestationPolicyId } =
        buildSponsoredAttestationGasContext(termsConfig.paymasterPolicyId);

      if (!context) {
        const fallback = getAttestationGasContext();
        context = fallback.context;
        isSponsored = fallback.isSponsored;
      }

      logger.debug("Attestation gas context:", {
        isSponsored,
        policyId: attestationPolicyId ?? context?.paymasterService?.policyId,
        termsPlatform: termsConfig.platformName,
      });

      const uoCall = {
        target: (EAS_CONTRACT_ADDRESS.startsWith("0x") ? EAS_CONTRACT_ADDRESS : `0x${EAS_CONTRACT_ADDRESS}`) as `0x${string}`,
        data: encodeFunctionData({
          abi: EAS_ABI,
          functionName: "attest",
          args: [
            EAS_UPLOAD_SCHEMA_UID as `0x${string}`,
            {
              recipient: "0x0000000000000000000000000000000000000000",
              expirationTime: 0n,
              revocable: false,
              refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
              data: encoded,
              value: 0n,
            },
          ],
        }) as `0x${string}`,
      };

      setStatus("submitting");

      let uoResult: Awaited<ReturnType<typeof client.sendUserOperation>>;
      try {
        uoResult = await client.sendUserOperation({
          uo: uoCall,
          context,
        });
        logger.debug("Attestation UserOp hash:", uoResult.hash);
      } catch (firstErr) {
        const firstError = firstErr instanceof Error ? firstErr : new Error(String(firstErr));
        logger.error("Attestation UserOp failed with sponsor context:", {
          error: firstError.message,
          isSponsored,
          hasContext: !!context,
          policyId: attestationPolicyId ?? context?.paymasterService?.policyId,
        });

        // If sponsorship failed, decide whether we can retry with ETH or USDC, or if the user needs to add gas.
        if (context) {
          const parsed = parseBundlerError(firstError);
          const scaAddress = client.scaAddress;
          const { ethBalance, usdcBalance } = await fetchGasBalances(scaAddress);

          logger.warn("Attestation sponsor failed — checking gas options:", {
            error: firstError.message,
            parsed: parsed.code,
            ethBalance: formatEther(ethBalance),
            usdcBalance: formatUnits(usdcBalance, 6),
          });

          // Option 1: user has enough ETH to pay gas themselves
          if (ethBalance >= MIN_ETH_FOR_GAS) {
            logger.warn("Retrying attestation with ETH gas payment...");
            toast.info("Sponsor gas failed — using ETH from your wallet");
            uoResult = await client.sendUserOperation({
              uo: uoCall,
              context: undefined,
            });
            logger.debug("Attestation UserOp hash (ETH fallback):", uoResult.hash);
          }
          // Option 2: user has USDC and a USDC paymaster policy exists — retry with USDC gas
          else if (usdcBalance >= MIN_USDC_FOR_GAS && process.env.NEXT_PUBLIC_ANYTOKEN_POLICY_ID) {
            logger.warn("Retrying attestation with USDC paymaster...");
            toast.info("Sponsor gas failed — using USDC from your wallet");
            const usdcContext = getGasContext("usdc").context;
            uoResult = await client.sendUserOperation({
              uo: uoCall,
              context: usdcContext,
            });
            logger.debug("Attestation UserOp hash (USDC fallback):", uoResult.hash);
          }
          // Option 3: no gas available — surface a clear "add gas" message
          else {
            const hasNoTokens = ethBalance === 0n && usdcBalance === 0n;
            const message = hasNoTokens
              ? `Your smart account has no ETH or USDC, so this transaction cannot be submitted.`
              : `Your smart account does not have enough gas. You have ${formatEther(ethBalance)} ETH and ${formatUnits(usdcBalance, 6)} USDC.`;
            logger.error(message, { scaAddress, ethBalance, usdcBalance });

            setNeedsGas(scaAddress, ethBalance, usdcBalance);
            toast.error("Gas required — see options in the dialog");
            return null;
          }
        } else {
          throw firstError;
        }
      }

      toast.success("Attestation submitted — waiting for confirmation");

      try {
        await client.waitForUserOperationTransaction({ hash: uoResult.hash });
      } catch (waitErr) {
        logger.error("Attestation UserOp failed to mine:", waitErr);
        throw new Error("Attestation transaction did not confirm. Please try again.");
      }

      const found = await waitForAttestation(fetchAttestation);
      if (!found) {
        throw new Error("Attestation was not found on-chain after submission");
      }

      setAttestation(found);
      setStatus("success");
      toast.success("Attestation confirmed");
      return found;
    } catch (err) {
      logger.error("Attestation signing failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to sign attestation";
      setError(msg);
      setStatus("error");
      toast.error(msg);
      return null;
    }
  }, [address, client, fetchAttestation, getAttestationGasContext, getGasContext, fetchGasBalances, setNeedsGas, termsConfig]);

  useEffect(() => {
    void checkAttestation();
  }, [checkAttestation]);

  return {
    status,
    error,
    attestation,
    gasRequirement,
    isAttested: status === "success",
    needsAttestation: status === "needsAttestation" || status === "error" || status === "idle" || status === "needsGas",
    isLoading: status === "checking" || status === "signing" || status === "submitting",
    needsGas: status === "needsGas",
    checkAttestation,
    signAttestation,
    clearGasRequirement,
  };
}

async function waitForAttestation(
  fetchAttestation: () => Promise<UploadAttestation | null>,
  maxAttempts = 30,
  intervalMs = 3000
): Promise<UploadAttestation | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const found = await fetchAttestation();
      if (found) return found;
    } catch {
      // ignore polling errors
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return null;
}

const EAS_ABI = [
  {
    inputs: [
      { internalType: "bytes32", name: "schema", type: "bytes32" },
      {
        components: [
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint64", name: "expirationTime", type: "uint64" },
          { internalType: "bool", name: "revocable", type: "bool" },
          { internalType: "bytes32", name: "refUID", type: "bytes32" },
          { internalType: "bytes", name: "data", type: "bytes" },
          { internalType: "uint256", name: "value", type: "uint256" },
        ],
        internalType: "struct AttestationRequestData",
        name: "data",
        type: "tuple",
      },
    ],
    name: "attest",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;
