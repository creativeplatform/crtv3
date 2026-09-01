/**
 * Story Protocol IP Asset Registration Service
 * Handles registration of NFTs as IP Assets on Story Protocol
 */

import { StoryClient } from "@story-protocol/core-sdk";
import type { Address } from "viem";
import { serverLogger } from '@/lib/utils/logger';

import type {
  StoryIPRegistrationResult,
  StoryLicenseTerms,
} from "@/lib/types/story-protocol";
import {
  mintingFeeToWei,
  STORY_LICENSE_FEE_CURRENCY,
} from "@/lib/sdk/story/minting-fee";

/**
 * Register an NFT as an IP Asset on Story Protocol
 * @param client - Story Protocol client instance
 * @param nftContract - NFT contract address
 * @param tokenId - NFT token ID
 * @param metadataURI - IPFS metadata URI (optional); use IPA-standard metadata for attestation
 * @param metadataHash - Optional hash of metadata content (e.g. SHA-256 hex) for verification
 * @returns IP Asset registration result
 */
export async function registerIPAsset(
  client: StoryClient,
  nftContract: Address,
  tokenId: string,
  metadataURI?: string,
  metadataHash?: string
): Promise<{ ipId: string; txHash: string }> {
  try {
    // Register IP Asset using Story Protocol SDK
    // This will register the NFT as an IP Asset and return the IP ID
    const registerRequest: any = {
      nftContract,
      tokenId: BigInt(tokenId),
    };

    // Add metadata if provided (wrapped in ipMetadata object)
    if (metadataURI) {
      registerRequest.ipMetadata = {
        ipMetadataURI: metadataURI,
        ...(metadataHash ? { ipMetadataHash: metadataHash } : {}),
      };
    }

    const result = await client.ipAsset.register(registerRequest);

    return {
      ipId: result.ipId!,
      txHash: result.txHash!,
    };
  } catch (error) {
    serverLogger.error("Failed to register IP Asset:", error);
    throw new Error(
      `IP Asset registration failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Attach license terms to an IP Asset
 * If termsId is provided, attaches existing terms. Otherwise, registers new PIL terms from template.
 * @param client - Story Protocol client instance
 * @param ipId - IP Asset ID
 * @param licenseTerms - License terms configuration (either termsId for existing or template terms for new)
 * @returns License terms ID and transaction hash
 */
export async function attachLicenseTerms(
  client: StoryClient,
  ipId: string,
  licenseTerms: StoryLicenseTerms
): Promise<{ termsId: string; txHash: string }> {
  try {
    // If termsId is provided, attach existing license terms
    if (licenseTerms.termsId) {
      const result = await client.license.attachLicenseTerms({
        ipId: ipId as `0x${string}`,
        licenseTermsId: BigInt(licenseTerms.termsId),
      });

      return {
        termsId: licenseTerms.termsId,
        txHash: result.txHash!,
      };
    }

    // Otherwise, register new PIL terms from template and attach them
    // Use registerPilTermsAndAttach to do both in one transaction
    const result = await client.license.registerPilTermsAndAttach({
      ipId: ipId as `0x${string}`,
      licenseTermsData: [
        {
          terms: {
            // Required fields with defaults suitable for template-based licenses
            transferable: true,
            commercialUse: licenseTerms.commercialUse ?? false,
            // For commercial attribution, require it if commercial use is allowed (best practice)
            commercialAttribution: (licenseTerms.commercialUse ?? false) && (licenseTerms.derivativesAttribution ?? false),
            commercializerChecker: "0x0000000000000000000000000000000000000000" as `0x${string}`, // No restrictions
            commercializerCheckerData: "0x0000000000000000000000000000000000000000" as `0x${string}`,
            commercialRevShare: licenseTerms.revenueShare ?? 0, // 0-100, where 100 = 100%
            derivativesAllowed: licenseTerms.derivativesAllowed ?? false,
            derivativesAttribution: licenseTerms.derivativesAttribution ?? false,
            derivativesApproval: licenseTerms.derivativesApproval ?? false,
            derivativesReciprocal: licenseTerms.derivativesReciprocal ?? false,
            currency: STORY_LICENSE_FEE_CURRENCY,
            uri: licenseTerms.licenseTermsUri ?? "", // License terms URI (e.g. app video page) links IP back to source media
            // Required fields with sensible defaults
            defaultMintingFee: mintingFeeToWei(licenseTerms.defaultMintingFee),
            expiration: BigInt(0), // No expiration (0 = never expires)
            commercialRevCeiling: BigInt(0), // No ceiling (0 = unlimited)
            derivativeRevCeiling: BigInt(0), // No ceiling (0 = unlimited)
          },
        },
      ],
    });

    // Extract the license terms ID from the response
    const termsId = result.licenseTermsIds?.[0]?.toString() || "";
    if (!termsId) {
      throw new Error("Failed to get license terms ID from registration response");
    }

    return {
      termsId,
      txHash: result.txHash!,
    };
  } catch (error) {
    serverLogger.error("Failed to attach license terms:", error);
    throw new Error(
      `License terms attachment failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Verify if an IP Asset is registered on Story Protocol
 * @param client - Story Protocol client instance
 * @param nftContract - NFT contract address
 * @param tokenId - NFT token ID
 * @param chainId - Chain ID as bigint (1315 for aeneid testnet, 1514 for mainnet)
 * @returns IP Asset ID and registration status
 */
export async function verifyIPAssetRegistration(
  client: StoryClient,
  nftContract: Address,
  tokenId: string,
  chainId: bigint = BigInt(1315) // Default to aeneid testnet
): Promise<{ ipId: string; isRegistered: boolean } | null> {
  try {
    // First, compute the IP ID for this NFT
    const ipIdResult = await client.ipAsset.ipAssetRegistryClient.ipId({
      chainId: chainId,
      tokenContract: nftContract,
      tokenId: BigInt(tokenId),
    });

    const ipId = ipIdResult;

    // Then check if it's registered using the IP ID
    const isRegistered = await client.ipAsset.ipAssetRegistryClient.isRegistered({
      id: ipId,
    });

    return {
      ipId: ipId,
      isRegistered: isRegistered,
    };
  } catch (error) {
    serverLogger.error("Failed to verify IP Asset registration:", error);
    return null;
  }
}

