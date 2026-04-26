/**
 * NFT Minting Service
 * Handles minting ERC-721 NFTs for video assets
 * 
 * This service supports two modes:
 * 1. Base chain: Traditional ERC-721 minting (existing functionality)
 * 2. Story Protocol: Minting via SPG with automatic IP registration (new)
 * 
 * The contract address is configurable via environment variables.
 */

import type { Address, Hex } from "viem";
import { encodeFunctionData, parseAbi, parseEther } from "viem";
import { publicClient } from "@/lib/viem";
import { createStoryClient } from "@/lib/sdk/story/client";
import { mintAndRegisterIp, mintAndRegisterIpAndAttachPilTerms, createCollection } from "@/lib/sdk/story/spg-service";
import { PILFlavor } from "@story-protocol/core-sdk";
import { WIP_TOKEN_ADDRESS } from "@/lib/sdk/story/constants";
import { serverLogger } from "@/lib/utils/logger";
import { appendBuilderCode } from "@/lib/utils/builder-code";

// Standard ERC721 ABI for minting
const ERC721_MINT_ABI = parseAbi([
  "function safeMint(address to, string memory uri) public returns (uint256)",
  "function mint(address to, string memory uri) public returns (uint256)",
  "function mint(address to) public returns (uint256)",
  "function totalSupply() public view returns (uint256)",
  "function tokenURI(uint256 tokenId) public view returns (string memory)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

/**
 * Mint an NFT using an ERC-721 contract
 * @param smartAccountClient - Smart account client from Account Kit
 * @param nftContractAddress - ERC-721 contract address
 * @param recipient - Address to receive the NFT
 * @param metadataURI - IPFS/URI for NFT metadata
 * @returns Mint result with token ID and transaction hash
 */
export async function mintVideoNFT(
  smartAccountClient: any, // Smart account client from Account Kit
  nftContractAddress: Address,
  recipient: Address,
  metadataURI: string
): Promise<{ tokenId: string; contractAddress: Address; txHash: string }> {
  try {
    // Get current total supply to estimate the new token ID
    // The actual token ID will be extracted from the Transfer event
    let estimatedTokenId: bigint = BigInt(0);
    try {
      const totalSupply = await publicClient.readContract({
        address: nftContractAddress,
        abi: ERC721_MINT_ABI,
        functionName: "totalSupply",
      });
      estimatedTokenId = BigInt(totalSupply as bigint);
    } catch (error) {
      serverLogger.warn("Could not read totalSupply, will extract token ID from Transfer event:", error);
    }

    // Try safeMint first (more common), fallback to mint if needed
    let mintData: Hex;
    try {
      mintData = encodeFunctionData({
        abi: ERC721_MINT_ABI,
        functionName: "safeMint",
        args: [recipient, metadataURI],
      });
    } catch {
      // Fallback to regular mint
      try {
        mintData = encodeFunctionData({
          abi: ERC721_MINT_ABI,
          functionName: "mint",
          args: [recipient, metadataURI],
        });
      } catch {
        // Fallback to mint without URI
        mintData = encodeFunctionData({
          abi: ERC721_MINT_ABI,
          functionName: "mint",
          args: [recipient],
        });
      }
    }

    // Send the mint transaction via smart account
    const operation = await smartAccountClient.sendUserOperation({
      uo: {
        target: nftContractAddress,
        data: appendBuilderCode(mintData),
        value: BigInt(0),
      },
    });

    // Wait for the transaction to be mined
    const txHash = await smartAccountClient.waitForUserOperationTransaction({
      hash: operation.hash,
    });

    // Extract the actual token ID from the Transfer event in the transaction receipt
    let tokenId: bigint = estimatedTokenId;
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      // Find the Transfer event (from address zero = mint event)
      const transferEvent = receipt.logs.find((log) => {
        try {
          // Try to decode as Transfer event
          // The Transfer event signature is keccak256("Transfer(address,address,uint256)")
          // For minting, from should be address(0)
          return log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
            log.topics[1] === "0x0000000000000000000000000000000000000000000000000000000000000000";
        } catch {
          return false;
        }
      });

      if (transferEvent && transferEvent.topics[3]) {
        // Extract token ID from the third topic (indexed parameter)
        tokenId = BigInt(transferEvent.topics[3]);
      } else {
        // Fallback: try to read the token ID by checking balance change
        // This is less reliable but better than nothing
        serverLogger.warn("Could not extract token ID from Transfer event, using estimated value");
      }
    } catch (error) {
      serverLogger.warn("Could not extract token ID from receipt, using estimated value:", error);
    }

    return {
      tokenId: tokenId.toString(),
      contractAddress: nftContractAddress,
      txHash: txHash as string,
    };
  } catch (error) {
    serverLogger.error("Failed to mint NFT:", error);
    throw new Error(
      `NFT minting failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get NFT contract address from environment
 * @returns NFT contract address or null if not configured
 */
export function getNFTContractAddress(): Address | null {
  const address = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
  if (!address) {
    return null;
  }
  // Basic validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    serverLogger.warn("Invalid NFT contract address format:", address);
    return null;
  }
  return address as Address;
}

/**
 * Parameters for license terms configuration
 */
export interface LicenseParams {
  commercialRevShare: number; // Percentage (0-100)
  mintingFee: string; // Fee amount in string format (e.g., "1")
}

/**
 * Mint an NFT on Story Protocol using SPG (Story Protocol Gateway)
 * This mints the NFT and registers it as an IP Asset in one transaction
 * 
 * Ownership Model:
 * - The `recipient` parameter determines who receives the NFT (IP ownership)
 * - The platform can mint on behalf of creators by setting recipient to creator's address
 * - The creator owns the collection (set during collection creation)
 * - The platform signs transactions (pays gas) but doesn't own the IP
 * 
 * Royalty Distribution:
 * - If `splitsAddress` is provided, sets EIP-2981 royalty recipient to the split contract
 * - This enables automatic royalty distribution to collaborators via splits.org
 * - Royalties from secondary sales will be automatically split according to the split contract configuration
 * 
 * @param creatorAddress - Creator's wallet address (used for client context)
 * @param recipient - Address to receive the NFT (should be creator's address for creator ownership)
 * @param metadataURI - IPFS/URI for NFT metadata
 * @param collectionAddress - Address of the SPG NFT collection (owned by creator)
 * @param customTransport - Optional custom transport for client-side signing
 * @param licenseParams - Optional parameters to attach license terms with fees
 * @returns Mint result with token ID, collection address, IP ID, and transaction hash
 * 
 * @note To set royalties to a split contract, call setTokenRoyaltyToSplit separately after minting
 * @see setTokenRoyaltyToSplit in ./royalty-service.ts
 */
export async function mintVideoNFTOnStory(
  creatorAddress: Address,
  recipient: Address,
  metadataURI: string,
  collectionAddress: Address,
  customTransport?: any,
  licenseParams?: LicenseParams
): Promise<{
  tokenId: string;
  collectionAddress: Address;
  ipId: string;
  txHash: string;
  licenseTermsIds?: string[];
}> {
  try {
    // Create Story Protocol client with optional custom transport
    const storyClient = createStoryClient(creatorAddress, undefined, customTransport);

    if (licenseParams) {
      serverLogger.debug("Minting with license terms:", licenseParams);
      // Mint, register, and attach PIL terms
      const result = await mintAndRegisterIpAndAttachPilTerms(storyClient, {
        collectionAddress,
        recipient,
        metadataURI,
        allowDuplicates: false,
        licenseTermsData: [
          {
            terms: PILFlavor.commercialRemix({
              commercialRevShare: licenseParams.commercialRevShare,
              defaultMintingFee: parseEther(licenseParams.mintingFee),
              currency: WIP_TOKEN_ADDRESS,
            }),
          },
        ],
      });

      return {
        tokenId: result.tokenId,
        collectionAddress,
        ipId: result.ipId,
        txHash: result.txHash,
        licenseTermsIds: result.licenseTermsIds,
      };
    } else {
      // Mint and register as IP Asset only (no license terms)
      const result = await mintAndRegisterIp(storyClient, {
        collectionAddress,
        recipient,
        metadataURI,
        allowDuplicates: false,
      });

      return {
        tokenId: result.tokenId,
        collectionAddress,
        ipId: result.ipId,
        txHash: result.txHash,
      };
    }
  } catch (error) {
    serverLogger.error("Failed to mint NFT on Story Protocol:", error);
    throw new Error(
      `Story Protocol NFT minting failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Create a new collection and mint an NFT on Story Protocol
 *
 * @param creatorAddress - Creator's wallet address
 * @param recipient - Address to receive the NFT
 * @param metadataURI - IPFS/URI for NFT metadata
 * @param name - Collection name
 * @param symbol - Collection symbol
 * @param customTransport - Optional custom transport
 * @param licenseParams - Optional license parameters
 */
export async function createCollectionAndMintVideoNFTOnStory(
  accountAddress: Address, // Account address for SDK (should match private key if provided)
  recipient: Address,
  metadataURI: string,
  name: string,
  symbol: string,
  customTransport?: any,
  licenseParams?: LicenseParams,
  privateKey?: string, // Optional private key for server-side signing
  creatorAddress?: Address // Optional creator address for collection ownership (defaults to accountAddress)
) {
  try {
    // Use private key if provided (server-side signing), otherwise rely on SDK's default behavior
    // The accountAddress should match the private key address for proper signing
    const storyClient = createStoryClient(accountAddress, privateKey, customTransport);
    
    // Use creatorAddress if provided, otherwise use accountAddress
    // The owner determines who owns the collection on-chain
    // The accountAddress is used for signing transactions (paying gas)
    // These can be different: platform pays gas, creator owns collection
    const collectionOwner = creatorAddress || accountAddress;

    serverLogger.debug("Creating collection...", { 
      name, 
      symbol, 
      accountAddress, // Address used for signing (funding wallet - pays gas)
      collectionOwner, // Address that owns the collection (creator - true owner)
      recipient, // Address that receives the NFT (creator - IP owner)
    });
    
    // IMPORTANT: Story Protocol's mintAndRegisterIp requires the caller to be authorized.
    // Since the funding wallet (accountAddress) is signing transactions, it needs to be
    // the collection owner OR the collection needs public minting enabled.
    // 
    // For now, we set the funding wallet as owner so it can mint on behalf of creators.
    // The recipient parameter ensures the NFT goes to the creator, maintaining creator ownership
    // of the IP even though the platform wallet owns the collection contract.
    // 
    // Alternative: Enable public minting (isPublicMinting: true) but this allows anyone to mint.
    // Future: Implement a grant mechanism if SPG supports it.
    const { collectionAddress } = await createCollection(storyClient, {
      name,
      symbol,
      owner: accountAddress, // Funding wallet owns collection (needed for minting authorization)
      mintFeeRecipient: collectionOwner, // Creator receives mint fees
    });
    serverLogger.debug("Collection created at:", collectionAddress);

    let result;
    if (licenseParams) {
      result = await mintAndRegisterIpAndAttachPilTerms(storyClient, {
        collectionAddress,
        recipient,
        metadataURI,
        licenseTermsData: [
          {
            terms: PILFlavor.commercialRemix({
              commercialRevShare: licenseParams.commercialRevShare,
              defaultMintingFee: parseEther(licenseParams.mintingFee),
              currency: WIP_TOKEN_ADDRESS,
            }),
          },
        ],
      });
    } else {
      result = await mintAndRegisterIp(storyClient, {
        collectionAddress,
        recipient,
        metadataURI,
      });
    }

    return {
      ...result,
      collectionAddress
    };

  } catch (error) {
    serverLogger.error("Failed to create collection and mint on Story:", error);
    throw new Error(
      `Story Protocol create & mint failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

