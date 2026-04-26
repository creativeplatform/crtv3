/**
 * Story Protocol Gateway (SPG) Service
 * 
 * Provides high-level functions for interacting with Story Protocol's SPG,
 * which includes collection creation and mint-and-register operations.
 * 
 * SPG Methods Available:
 * - createCollection: Create a new NFT collection for a creator
 * - mintAndRegisterIp: Mint an NFT and register it as an IP Asset in one transaction
 * - mintAndRegisterIpAndAttachPilTerms: Mint, register, and attach license terms in one transaction
 */

import { StoryClient } from "@story-protocol/core-sdk";
import type { Address, Log } from "viem";
import { serverLogger } from '@/lib/utils/logger';


/**
 * Parameters for creating an NFT collection via SPG
 */
/**
 * Parameters for creating an NFT collection via SPG
 */
export interface CreateCollectionParams {
  name: string; // Collection name (e.g., "Creator Name's Videos")
  symbol: string; // Collection symbol (e.g., "CRTV")
  description?: string; // Optional collection description
  owner?: Address; // Collection owner address (defaults to client account)
  mintFeeRecipient?: Address; // Address to receive mint fees (defaults to owner)
  contractURI?: string; // IPFS URI for collection metadata
  baseURI?: string; // Base URI for token metadata
  maxSupply?: number; // Maximum supply of tokens (defaults to uint32 max)
}

/**
 * Result of creating a collection
 */
export interface CreateCollectionResult {
  collectionAddress: Address; // Address of the created NFT collection
  txHash: string; // Transaction hash
}

/**
 * Parameters for minting and registering an IP Asset
 */
export interface MintAndRegisterParams {
  collectionAddress: Address; // SPG NFT collection address
  recipient: Address; // Address to receive the NFT
  metadataURI?: string; // IPFS metadata URI (optional); use IPA-standard for attestation
  metadataHash?: string; // Optional hash of metadata content for verification
  allowDuplicates?: boolean; // Allow duplicate registrations (default: false)
}

/**
 * Result of minting and registering an IP Asset
 */
export interface MintAndRegisterResult {
  tokenId: string; // Minted NFT token ID
  ipId: string; // Story Protocol IP Asset ID
  txHash: string; // Transaction hash
}

/**
 * Parameters for minting, registering, and attaching PIL terms
 */
export interface MintAndRegisterWithLicenseParams extends MintAndRegisterParams {
  licenseTermsData: Array<{
    terms: {
      transferable: boolean;
      commercialUse: boolean;
      commercialAttribution: boolean; // Required by SDK
      commercializerChecker: Address; // Required by SDK (use zero address for no restrictions)
      commercializerCheckerData: Address; // Required by SDK (use zero address if not needed)
      commercialRevShare: number; // 0-100, where 100 = 100% (required by SDK)
      derivativesAllowed: boolean;
      derivativesAttribution: boolean; // Required by SDK
      derivativesApproval: boolean; // Required by SDK
      derivativesReciprocal: boolean; // Required by SDK
      currency: Address; // Payment currency (required by SDK, use zero address for native token)
      uri: string; // License terms URI (required by SDK, use empty string if not needed)
      defaultMintingFee: bigint | number; // Minting fee in wei (required by SDK)
      expiration: bigint | number; // Expiration timestamp (0 = never expires, required by SDK)
      commercialRevCeiling: bigint | number; // Revenue ceiling for commercial use (required by SDK)
      derivativeRevCeiling: bigint | number; // Revenue ceiling for derivatives (required by SDK)
    };
  }>;
}

/**
 * Result of minting, registering, and attaching license terms
 */
export interface MintAndRegisterWithLicenseResult extends MintAndRegisterResult {
  licenseTermsIds: string[]; // Array of attached license terms IDs
}

/**
 * Create a new NFT collection using Story Protocol's SPG
 * 
 * @param client - Story Protocol client instance
 * @param params - Collection creation parameters
 * @returns Collection address and transaction hash
 */
export async function createCollection(
  client: StoryClient,
  params: CreateCollectionParams
): Promise<CreateCollectionResult> {
  try {
    // Get the account address from the client config (the signer)
    const accountAddress = ((client as any).config?.account) as Address;

    if (!accountAddress) {
      throw new Error("Account address not found. Please ensure client is configured with an account.");
    }

    // The owner parameter determines who owns the collection on-chain
    // The accountAddress is used for signing the transaction (paying gas)
    // These can be different: platform pays gas, creator owns collection
    const collectionOwner = params.owner || accountAddress;

    // Log collection creation parameters for debugging
    serverLogger.debug("Creating SPG NFT collection:", {
      name: params.name,
      symbol: params.symbol,
      owner: collectionOwner,
      mintFeeRecipient: params.mintFeeRecipient || collectionOwner,
      signer: accountAddress,
      maxSupply: params.maxSupply || 4294967295,
    });

    // Use nftClient.createNFTCollection() to create a new SPG NFT collection
    const result = await client.nftClient.createNFTCollection({
      name: params.name,
      symbol: params.symbol,
      isPublicMinting: false, // Only creator can mint initially
      mintOpen: true, // Collection is open for minting
      mintFeeRecipient: params.mintFeeRecipient || collectionOwner, // Creator receives mint fees
      contractURI: params.contractURI || "", // Can be set later if needed
      baseURI: params.baseURI || "", // Base URI for tokens
      maxSupply: params.maxSupply || 4294967295, // Default to max uint32
      owner: collectionOwner, // Collection owner (can be different from signer)
    });

    if (!result.txHash) {
      throw new Error("Collection creation transaction hash not returned");
    }

    // The SDK returns spgNftContract in the result
    let collectionAddress: Address;

    if (result.spgNftContract) {
      collectionAddress = result.spgNftContract;
    } else {
      // Fallback: Parse from transaction receipt events
      // SPG emits a CollectionCreated event with the collection address
      const { createStoryPublicClient } = await import("./client");
      const publicClient = createStoryPublicClient();

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: result.txHash as `0x${string}`,
      });

      // Look for CollectionCreated event in logs
      // Event signature: CollectionCreated(address indexed collection, ...)
      const collectionCreatedEvent = receipt.logs.find((log: Log) => {
        // CollectionCreated event signature (first 32 bytes of keccak256("CollectionCreated(address,string,string)"))
        return log.topics.length >= 2;
      });

      if (collectionCreatedEvent && collectionCreatedEvent.topics[1]) {
        // Extract address from topic (remove 0x prefix and pad, then take last 40 chars)
        const addressHex = collectionCreatedEvent.topics[1].slice(-40);
        collectionAddress = `0x${addressHex}` as Address;
      } else {
        throw new Error(
          "Could not extract collection address from transaction receipt. " +
          "Please check the transaction manually or update the SPG service."
        );
      }
    }

    return {
      collectionAddress,
      txHash: result.txHash,
    };
  } catch (error) {
    // Enhanced error handling for RPC errors
    let errorMessage = "Unknown error";
    let errorDetails: any = {};

    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for HTTP/RPC errors
      if (error.message.includes("HTTP request failed") || error.message.includes("is not valid JSON")) {
        errorDetails.type = "RPC_ERROR";
        errorDetails.message = "The RPC endpoint returned an invalid response. This may indicate:";
        errorDetails.possibleCauses = [
          "RPC endpoint is down or unreachable",
          "Invalid API key or authentication issue",
          "Rate limiting or quota exceeded",
          "Network connectivity issues",
          "Contract call failed on-chain (check contract address and parameters)",
        ];
        
        // Try to extract more details from the error
        if (error.stack) {
          errorDetails.stack = error.stack;
        }
        
        // Check if it's a JSON parsing error
        if (error.message.includes("Unexpected token")) {
          errorDetails.jsonParseError = true;
          errorDetails.hint = "The RPC endpoint returned a non-JSON response. Check the RPC URL and API key.";
        }
      }
      
      // Check for contract-specific errors
      if (error.message.includes("execution reverted") || error.message.includes("revert")) {
        errorDetails.type = "CONTRACT_ERROR";
        errorDetails.message = "The contract call was reverted. Possible reasons:";
        errorDetails.possibleCauses = [
          "Insufficient permissions (caller is not authorized)",
          "Invalid parameters passed to the contract",
          "Contract state prevents the operation",
          "Insufficient gas or balance",
        ];
      }
      
      // Check for network errors
      if (error.message.includes("network") || error.message.includes("ECONNREFUSED") || error.message.includes("fetch")) {
        errorDetails.type = "NETWORK_ERROR";
        errorDetails.message = "Network connectivity issue";
      }
    }

    serverLogger.error("Failed to create collection:", {
      error: errorMessage,
      details: errorDetails,
      params: {
        name: params.name,
        symbol: params.symbol,
        owner: params.owner,
      },
    });

    // Construct a more helpful error message
    const fullErrorMessage = errorDetails.type 
      ? `Collection creation failed (${errorDetails.type}): ${errorMessage}\n\n${errorDetails.message}\n\nPossible causes:\n${errorDetails.possibleCauses?.map((cause: string) => `- ${cause}`).join("\n") || "Unknown"}`
      : `Collection creation failed: ${errorMessage}`;

    throw new Error(fullErrorMessage);
  }
}

/**
 * Mint an NFT and register it as an IP Asset in one transaction
 * 
 * @param client - Story Protocol client instance
 * @param params - Mint and register parameters
 * @returns Token ID, IP ID, and transaction hash
 */
export async function mintAndRegisterIp(
  client: StoryClient,
  params: MintAndRegisterParams
): Promise<MintAndRegisterResult> {
  try {
    const result = await client.ipAsset.mintAndRegisterIp({
      spgNftContract: params.collectionAddress,
      recipient: params.recipient,
      ipMetadata: params.metadataURI
        ? {
            ipMetadataURI: params.metadataURI,
            ...(params.metadataHash
              ? { ipMetadataHash: params.metadataHash as `0x${string}` }
              : {}),
          }
        : undefined,
      allowDuplicates: params.allowDuplicates ?? false,
    });

    if (!result.txHash) {
      throw new Error("Mint and register transaction hash not returned");
    }

    // Extract token ID and IP ID from the result
    // The SDK should return these, but we may need to parse from events
    const tokenId = result.tokenId?.toString();
    const ipId = result.ipId;

    // Throw errors if critical IDs are missing to prevent database corruption
    if (!tokenId) {
      throw new Error(
        "Token ID not returned from mint and register operation. " +
        "This is required for database persistence. Transaction hash: " + result.txHash
      );
    }

    if (!ipId) {
      throw new Error(
        "IP ID not returned from mint and register operation. " +
        "This is required for database persistence. Transaction hash: " + result.txHash
      );
    }

    return {
      tokenId,
      ipId,
      txHash: result.txHash,
    };
  } catch (error) {
    serverLogger.error("Failed to mint and register IP Asset:", error);
    throw new Error(
      `Mint and register failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Parameters for minting and registering a derivative IP Asset
 */
export interface MintAndRegisterDerivativeParams {
  collectionAddress: Address; // SPG NFT collection address for the derivative (clip)
  recipient: Address;         // Address to receive the minted derivative NFT
  parentIpIds: Address[];     // Parent IP Asset IDs (the source stream)
  licenseTermsIds: string[];  // License terms on the parent that permit derivatives
  metadataURI?: string;
  metadataHash?: string;
  allowDuplicates?: boolean;
}

export interface MintAndRegisterDerivativeResult extends MintAndRegisterResult {
  parentIpIds: Address[];
}

/**
 * Mint an NFT, register it as a derivative IP Asset of one or more parents,
 * inheriting their PIL terms (e.g. commercial revenue share flows back to the parent).
 */
export async function mintAndRegisterDerivative(
  client: StoryClient,
  params: MintAndRegisterDerivativeParams
): Promise<MintAndRegisterDerivativeResult> {
  if (!params.parentIpIds.length) {
    throw new Error("mintAndRegisterDerivative requires at least one parent IP ID");
  }
  if (!params.licenseTermsIds.length) {
    throw new Error("mintAndRegisterDerivative requires at least one license terms ID");
  }

  try {
    const result = await client.ipAsset.mintAndRegisterIpAndMakeDerivative({
      spgNftContract: params.collectionAddress,
      recipient: params.recipient,
      derivData: {
        parentIpIds: params.parentIpIds,
        licenseTermsIds: params.licenseTermsIds.map((id) => BigInt(id)),
      },
      ipMetadata: params.metadataURI
        ? {
            ipMetadataURI: params.metadataURI,
            ...(params.metadataHash
              ? { ipMetadataHash: params.metadataHash as `0x${string}` }
              : {}),
          }
        : undefined,
      allowDuplicates: params.allowDuplicates ?? true,
    });

    if (!result.txHash) {
      throw new Error("Derivative mint transaction hash not returned");
    }

    const tokenId = result.tokenId?.toString();
    const ipId = result.ipId;

    if (!tokenId) {
      throw new Error(
        "Token ID not returned from derivative mint operation. Transaction hash: " + result.txHash
      );
    }
    if (!ipId) {
      throw new Error(
        "IP ID not returned from derivative mint operation. Transaction hash: " + result.txHash
      );
    }

    return {
      tokenId,
      ipId,
      txHash: result.txHash,
      parentIpIds: params.parentIpIds,
    };
  } catch (error) {
    serverLogger.error("Failed to mint and register derivative IP Asset:", error);
    throw new Error(
      `Derivative mint failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Mint an NFT, register it as an IP Asset, and attach PIL terms in one transaction
 *
 * @param client - Story Protocol client instance
 * @param params - Mint, register, and license parameters
 * @returns Token ID, IP ID, license terms IDs, and transaction hash
 */
export async function mintAndRegisterIpAndAttachPilTerms(
  client: StoryClient,
  params: MintAndRegisterWithLicenseParams
): Promise<MintAndRegisterWithLicenseResult> {
  try {
    const result = await client.ipAsset.mintAndRegisterIpAssetWithPilTerms({
      spgNftContract: params.collectionAddress,
      recipient: params.recipient,
      ipMetadata: params.metadataURI
        ? {
            ipMetadataURI: params.metadataURI,
            ...(params.metadataHash
              ? { ipMetadataHash: params.metadataHash as `0x${string}` }
              : {}),
          }
        : undefined,
      licenseTermsData: params.licenseTermsData,
      allowDuplicates: params.allowDuplicates ?? false,
    });

    if (!result.txHash) {
      throw new Error("Mint, register, and attach license transaction hash not returned");
    }

    const tokenId = result.tokenId?.toString();
    const ipId = result.ipId;
    const licenseTermsIds = result.licenseTermsIds?.map((id) => id.toString()) || [];

    // Throw errors if critical IDs are missing to prevent database corruption
    if (!tokenId) {
      throw new Error(
        "Token ID not returned from mint, register, and attach license operation. " +
        "This is required for database persistence. Transaction hash: " + result.txHash
      );
    }

    if (!ipId) {
      throw new Error(
        "IP ID not returned from mint, register, and attach license operation. " +
        "This is required for database persistence. Transaction hash: " + result.txHash
      );
    }

    return {
      tokenId,
      ipId,
      licenseTermsIds,
      txHash: result.txHash,
    };
  } catch (error) {
    serverLogger.error("Failed to mint, register, and attach license terms:", error);
    throw new Error(
      `Mint, register, and attach license failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

