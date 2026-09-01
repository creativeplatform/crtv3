"use server";

/**
 * Server-side Story Protocol service functions
 * Orchestrates IP Asset registration and management
 */

import { createStoryClient } from "@/lib/sdk/story/client";
import { registerIPAsset, attachLicenseTerms } from "@/lib/sdk/story/ip-registration";
import {
  mintAndRegisterIp,
  mintAndRegisterIpAndAttachPilTerms,
  type MintAndRegisterWithLicenseParams,
} from "@/lib/sdk/story/spg-service";
import { getOrCreateCreatorCollection } from "@/lib/sdk/story/collection-service";
import { buildAndUploadIpaMetadata } from "@/lib/sdk/story/ipa-metadata";
import { updateVideoAssetStoryIPStatus } from "./video-assets";
import type { VideoAsset } from "@/lib/types/video-asset";
import {
  mintingFeeToWei,
  STORY_LICENSE_FEE_CURRENCY,
} from "@/lib/sdk/story/minting-fee";
import type {
  StoryIPRegistrationOptions,
  StoryIPRegistrationResult,
  StoryLicenseTerms,
  StoryIPAssetStatus,
} from "@/lib/types/story-protocol";
import type { Address } from "viem";

/** Build canonical source video URL for IP/license metadata (links back to app video). */
function getStorySourceVideoUrl(videoAsset: { playback_id?: string }, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const playbackId = videoAsset.playback_id ?? "";
  return playbackId ? `${base.replace(/\/$/, "")}/watch/${playbackId}` : "";
}

/**
 * Register a video as an IP Asset on Story Protocol
 * This orchestrates the full flow: mint NFT (if needed) -> register IP Asset -> attach license terms
 * 
 * @param videoAsset - Video asset to register
 * @param creatorAddress - Creator's wallet address
 * @param options - Registration options including license terms
 * @returns Registration result
 */
export async function registerVideoAsIPAsset(
  videoAsset: VideoAsset,
  creatorAddress: Address,
  options: StoryIPRegistrationOptions
): Promise<StoryIPRegistrationResult> {
  try {
    // Validate inputs
    if (!options.registerIP) {
      return {
        success: false,
        error: "IP registration not requested",
      };
    }

    if (!creatorAddress) {
      return {
        success: false,
        error: "Creator address is required",
      };
    }

    // Create Story Protocol client
    const storyClient = createStoryClient(creatorAddress);

    let nftContract: Address;
    let tokenId: string;

    // Step 1: Ensure video has an NFT (must be minted before IP registration)
    // Note: NFT minting functionality is not yet implemented in this integration.
    // Videos must be minted as NFTs through other means before IP registration.
    if (!videoAsset.contract_address || !videoAsset.token_id) {
      return {
        success: false,
        error: "Video must have an NFT minted before IP registration. Please mint the NFT first through your NFT minting flow, then register the IP Asset.",
      };
    }

    // Use existing NFT
    nftContract = videoAsset.contract_address as Address;
    tokenId = videoAsset.token_id;

    // Step 2: Register NFT as IP Asset on Story Protocol
    // Use IPA-standard metadata (with mediaUrl, mediaType, etc.) when not provided so attestation can run
    let ipId: string;
    let registrationTx: string;

    let ipMetadataURI: string | undefined = options.metadataURI ?? videoAsset.metadata_uri ?? undefined;
    let ipMetadataHash: string | undefined;

    if (!ipMetadataURI) {
      try {
        const uploaded = await buildAndUploadIpaMetadata(videoAsset, {
          sourceVideoUrl: options.sourceVideoUrl ?? getStorySourceVideoUrl(videoAsset),
          creatorAddress: creatorAddress,
        });
        ipMetadataURI = uploaded.ipMetadataURI;
        ipMetadataHash = uploaded.ipMetadataHash;
      } catch (uploadError) {
        console.error("IPA metadata build/upload failed, registering without metadata:", uploadError);
      }
    }

    try {
      const registrationResult = await registerIPAsset(
        storyClient,
        nftContract,
        tokenId,
        ipMetadataURI,
        ipMetadataHash
      );

      ipId = registrationResult.ipId;
      registrationTx = registrationResult.txHash;
    } catch (regError) {
      console.error("IP Asset registration failed:", regError);
      return {
        success: false,
        error: `IP Asset registration failed: ${regError instanceof Error ? regError.message : "Unknown error"}`,
      };
    }

    // Step 3: Attach license terms if provided (with source video URI so license points back to media)
    let licenseTermsId: string | undefined;
    const sourceVideoUrl = options.sourceVideoUrl ?? getStorySourceVideoUrl(videoAsset);

    if (options.licenseTerms) {
      try {
        const termsWithUri = {
          ...options.licenseTerms,
          licenseTermsUri: options.licenseTerms.licenseTermsUri ?? sourceVideoUrl,
        };
        const licenseResult = await attachLicenseTerms(
          storyClient,
          ipId,
          termsWithUri
        );

        licenseTermsId = licenseResult.termsId;
      } catch (licenseError) {
        console.error("License terms attachment failed:", licenseError);
        // Don't fail the entire registration if license attachment fails
        // The IP Asset is still registered, license can be attached later
        console.warn("IP Asset registered but license terms attachment failed");
      }
    }

    // Step 4: Update video asset in database with Story Protocol data
    try {
      await updateVideoAssetStoryIPStatus(videoAsset.id, {
        story_ip_registered: true,
        story_ip_id: ipId,
        story_ip_registration_tx: registrationTx,
        story_license_terms_id: licenseTermsId || null,
        story_license_template_id: options.licenseTerms?.templateId || null,
      });
    } catch (dbError) {
      console.error("Failed to update video asset with Story Protocol data:", dbError);
      // IP Asset is registered on-chain, but DB update failed
      // Return success but log the error
      console.warn("IP Asset registered on-chain but database update failed");
    }

    return {
      success: true,
      ipId,
      registrationTx,
      licenseTermsId,
    };
  } catch (error) {
    console.error("Story Protocol registration error:", error);
    return {
      success: false,
      error: `Registration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get IP Asset status from Story Protocol
 * @param nftContract - NFT contract address
 * @param tokenId - NFT token ID
 * @param creatorAddress - Creator's wallet address (for client creation)
 * @returns IP Asset status
 */
export async function getIPAssetStatus(
  nftContract: Address,
  tokenId: string,
  creatorAddress: Address
): Promise<StoryIPAssetStatus | null> {
  try {
    const storyClient = createStoryClient(creatorAddress);
    const { verifyIPAssetRegistration } = await import("@/lib/sdk/story/ip-registration");

    // Use the chain ID from environment (1315 for aeneid testnet, 1514 for mainnet)
    const network = process.env.NEXT_PUBLIC_STORY_NETWORK || "testnet";
    const chainId = network === "testnet" ? BigInt(1315) : BigInt(1514);

    const result = await verifyIPAssetRegistration(storyClient, nftContract, tokenId, chainId);

    if (!result || !result.isRegistered) {
      return {
        ipId: result?.ipId || "",
        exists: false,
      };
    }

    return {
      ipId: result.ipId,
      exists: true,
      nftContract: nftContract,
      tokenId: tokenId,
    };
  } catch (error) {
    console.error("Failed to get IP Asset status:", error);
    return null;
  }
}

/**
 * Attach license terms to an existing IP Asset
 * @param ipId - IP Asset ID
 * @param creatorAddress - Creator's wallet address
 * @param licenseTerms - License terms to attach
 * @returns Success status and license terms ID
 */
export async function attachLicenseTermsToIP(
  ipId: string,
  creatorAddress: Address,
  licenseTerms: StoryLicenseTerms
): Promise<{ success: boolean; termsId?: string; error?: string }> {
  try {
    const storyClient = createStoryClient(creatorAddress);
    const result = await attachLicenseTerms(storyClient, ipId, licenseTerms);

    return {
      success: true,
      termsId: result.termsId,
    };
  } catch (error) {
    console.error("Failed to attach license terms:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mint an NFT and register it as an IP Asset on Story Protocol in one transaction
 * Uses Story Protocol's SPG (Story Protocol Gateway) for efficient mint-and-register
 * 
 * @param videoAsset - Video asset to mint and register
 * @param creatorAddress - Creator's wallet address
 * @param metadataURI - IPFS metadata URI for the NFT
 * @param collectionName - Name for the creator's collection (if creating new collection)
 * @param collectionSymbol - Symbol for the creator's collection (if creating new collection)
 * @param licenseTerms - Optional license terms to attach during minting
 * @returns Mint and registration result
 */
export async function mintAndRegisterVideoIP(
  videoAsset: VideoAsset,
  creatorAddress: Address,
  metadataURI: string,
  collectionName?: string,
  collectionSymbol?: string,
  licenseTerms?: StoryLicenseTerms
): Promise<{
  success: boolean;
  tokenId?: string;
  collectionAddress?: Address;
  ipId?: string;
  txHash?: string;
  licenseTermsIds?: string[];
  error?: string;
}> {
  try {
    if (!creatorAddress) {
      return {
        success: false,
        error: "Creator address is required",
      };
    }

    // Create Story Protocol client
    const storyClient = createStoryClient(creatorAddress);

    // Step 1: Get or create creator's collection
    const defaultCollectionName = collectionName || `${creatorAddress.slice(0, 6)}'s Videos`;
    const defaultCollectionSymbol = collectionSymbol || "CRTV";
    
    let collectionAddress: Address;
    try {
      collectionAddress = await getOrCreateCreatorCollection(
        storyClient,
        creatorAddress,
        defaultCollectionName,
        defaultCollectionSymbol
      );
    } catch (collectionError) {
      console.error("Failed to get or create collection:", collectionError);
      return {
        success: false,
        error: `Collection creation failed: ${collectionError instanceof Error ? collectionError.message : "Unknown error"}`,
      };
    }

    // Step 2: Build and upload IPA-standard metadata so attestation can run (unless caller provided URI)
    let metadataURIToUse = metadataURI;
    let metadataHashToUse: string | undefined;
    if (!metadataURIToUse) {
      try {
        const uploaded = await buildAndUploadIpaMetadata(videoAsset, {
          sourceVideoUrl: licenseTerms?.licenseTermsUri ?? getStorySourceVideoUrl(videoAsset),
          creatorAddress: creatorAddress,
        });
        metadataURIToUse = uploaded.ipMetadataURI;
        metadataHashToUse = uploaded.ipMetadataHash;
      } catch (uploadError) {
        console.error("IPA metadata build/upload failed, minting without IP metadata:", uploadError);
      }
    }

    // Step 3: Mint NFT and register as IP Asset (with optional license terms)
    let result: {
      tokenId: string;
      ipId: string;
      txHash: string;
      licenseTermsIds?: string[];
    };

    if (licenseTerms) {
      // Source video URL for PIL terms uri (links IP license back to app video)
      const sourceVideoUrl = licenseTerms.licenseTermsUri ?? getStorySourceVideoUrl(videoAsset);
      const licenseParams: MintAndRegisterWithLicenseParams = {
        collectionAddress,
        recipient: creatorAddress,
        metadataURI: metadataURIToUse,
        metadataHash: metadataHashToUse,
        allowDuplicates: false,
        licenseTermsData: [
          {
            terms: {
              transferable: true,
              commercialUse: licenseTerms.commercialUse ?? false,
              commercialAttribution:
                (licenseTerms.commercialUse ?? false) &&
                (licenseTerms.derivativesAttribution ?? false),
              commercializerChecker: "0x0000000000000000000000000000000000000000" as Address,
              commercializerCheckerData: "0x0000000000000000000000000000000000000000" as Address,
              commercialRevShare: licenseTerms.revenueShare ?? 0,
              derivativesAllowed: licenseTerms.derivativesAllowed ?? false,
              derivativesAttribution: licenseTerms.derivativesAttribution ?? false,
              derivativesApproval: licenseTerms.derivativesApproval ?? false,
              derivativesReciprocal: licenseTerms.derivativesReciprocal ?? false,
              currency: STORY_LICENSE_FEE_CURRENCY,
              uri: sourceVideoUrl, // License terms URI points back to source video
              defaultMintingFee: mintingFeeToWei(licenseTerms.defaultMintingFee),
              expiration: 0, // Required by SDK (0 = never expires)
              commercialRevCeiling: 0, // Required by SDK
              derivativeRevCeiling: 0, // Required by SDK
            },
          },
        ],
      };

      const mintResult = await mintAndRegisterIpAndAttachPilTerms(
        storyClient,
        licenseParams
      );

      result = {
        tokenId: mintResult.tokenId,
        ipId: mintResult.ipId,
        txHash: mintResult.txHash,
        licenseTermsIds: mintResult.licenseTermsIds,
      };
    } else {
      // Just mint and register (no license terms)
      const mintResult = await mintAndRegisterIp(storyClient, {
        collectionAddress,
        recipient: creatorAddress,
        metadataURI: metadataURIToUse,
        metadataHash: metadataHashToUse,
        allowDuplicates: false,
      });

      result = {
        tokenId: mintResult.tokenId,
        ipId: mintResult.ipId,
        txHash: mintResult.txHash,
      };
    }

    // Step 4: Update video asset in database
    try {
      await updateVideoAssetStoryIPStatus(videoAsset.id, {
        story_ip_registered: true,
        story_ip_id: result.ipId,
        story_ip_registration_tx: result.txHash,
        story_license_terms_id: result.licenseTermsIds?.[0] || null,
        story_license_template_id: licenseTerms?.templateId || null,
        // Note: We should also update contract_address and token_id
        // This requires updating the updateVideoAssetStoryIPStatus function
      });

      // Also update the collection address and NFT contract/token info
      // Note: story_collection_address column is added by migration 20250118_add_creator_collections.sql
      // If the migration hasn't been applied, gracefully handle the missing column
      const { createServiceClient } = await import("@/lib/sdk/supabase/service");
      const supabase = createServiceClient();
      
      const updateData: Record<string, any> = {
        contract_address: collectionAddress,
        token_id: result.tokenId,
        story_collection_address: collectionAddress,
      };
      
      // Try to update with story_collection_address first
      // If the column doesn't exist (migration not applied), fall back to updating without it
      const { error: updateError } = await supabase
        .from("video_assets")
        .update(updateData)
        .eq("id", videoAsset.id);
      
      if (updateError) {
        // Check if error is due to missing column (PostgreSQL error code 42703 = undefined_column)
        const isColumnError = 
          updateError.code === "42703" ||
          updateError.message?.includes("story_collection_address") ||
          updateError.message?.includes("column") ||
          updateError.message?.toLowerCase().includes("does not exist");
        
        if (isColumnError) {
          console.warn(
            "story_collection_address column not found. " +
            "Please run migration 20250118_add_creator_collections.sql. " +
            "Updating without collection address..."
          );
          
          // Retry without the story_collection_address column
          const { error: retryError } = await supabase
            .from("video_assets")
            .update({
              contract_address: collectionAddress,
              token_id: result.tokenId,
            })
            .eq("id", videoAsset.id);
          
          if (retryError) {
            console.error("Failed to update video asset (retry without collection address):", retryError);
            // Don't throw - the on-chain registration succeeded, this is just metadata
          }
        } else {
          // Some other database error occurred
          console.error("Failed to update video asset with Story Protocol data:", updateError);
          // Don't throw - the on-chain registration succeeded, this is just metadata
        }
      }
    } catch (dbError) {
      console.error("Failed to update video asset with Story Protocol data:", dbError);
      // Continue - the on-chain registration succeeded
      console.warn("IP Asset minted and registered on-chain but database update failed");
    }

    return {
      success: true,
      tokenId: result.tokenId,
      collectionAddress,
      ipId: result.ipId,
      txHash: result.txHash,
      licenseTermsIds: result.licenseTermsIds,
    };
  } catch (error) {
    console.error("Mint and register IP Asset error:", error);
    return {
      success: false,
      error: `Mint and register failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

