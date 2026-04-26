/**
 * Royalty Service
 * Handles setting EIP-2981 royalties for NFTs
 * 
 * This service enables automatic royalty distribution to split contracts,
 * allowing revenue from secondary sales to be automatically split among collaborators.
 */

import type { Address } from "viem";
import { encodeFunctionData, parseAbi } from "viem";
import { serverLogger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


/**
 * ABI for EIP-2981 royalty functions
 * Compatible with CreatorIPCollection and other EIP-2981 compliant contracts
 */
const EIP2981_ROYALTY_ABI = parseAbi([
  "function setRoyaltyInfoForToken(uint256 tokenId, address recipient, uint256 bps) external",
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address recipient, uint256 royaltyAmount)",
  "function supportsInterface(bytes4 interfaceId) external view returns (bool)",
]);

/**
 * Default royalty percentage in basis points (5% = 500 bps)
 * This matches the default in CreatorIPCollection contract
 */
const DEFAULT_ROYALTY_BPS = 500;

/**
 * Set token-specific royalty to a split contract address
 * This enables automatic royalty distribution to collaborators via splits.org
 * 
 * @param smartAccountClient - Smart account client from Account Kit
 * @param collectionAddress - NFT collection contract address (must support EIP-2981)
 * @param tokenId - Token ID to set royalty for
 * @param splitAddress - Split contract address to receive royalties
 * @param royaltyBps - Royalty percentage in basis points (default: 500 = 5%)
 * @returns Transaction hash
 * 
 * @notice The collection contract must support EIP-2981 (IERC2981 interface)
 * @notice Only the collection owner can set royalties
 * @notice This sets a per-token royalty override, which takes precedence over default collection royalty
 */
export async function setTokenRoyaltyToSplit(
  smartAccountClient: any,
  collectionAddress: Address,
  tokenId: string,
  splitAddress: Address,
  royaltyBps: number = DEFAULT_ROYALTY_BPS
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!splitAddress || splitAddress === "0x0000000000000000000000000000000000000000") {
      return {
        success: false,
        error: "Invalid split address",
      };
    }

    // Validate royalty percentage (must be between 0 and 10000 basis points = 0-100%)
    if (royaltyBps < 0 || royaltyBps > 10000) {
      return {
        success: false,
        error: `Royalty percentage must be between 0 and 10000 basis points (0-100%). Got: ${royaltyBps}`,
      };
    }

    // Encode the setRoyaltyInfoForToken function call
    const setRoyaltyData = encodeFunctionData({
      abi: EIP2981_ROYALTY_ABI,
      functionName: "setRoyaltyInfoForToken",
      args: [BigInt(tokenId), splitAddress, BigInt(royaltyBps.toString())],
    });

    // Send the transaction via smart account
    const operation = await smartAccountClient.sendUserOperation({
      uo: {
        target: collectionAddress,
        data: appendBuilderCode(setRoyaltyData),
        value: BigInt(0),
      },
    });

    // Wait for the transaction to be mined
    const txHash = await smartAccountClient.waitForUserOperationTransaction({
      hash: operation.hash,
    });

    return {
      success: true,
      txHash: txHash as string,
    };
  } catch (error) {
    serverLogger.error("Failed to set token royalty to split:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error setting royalty",
    };
  }
}

/**
 * Check if a contract supports EIP-2981 royalty interface
 * @param publicClient - Public client for reading from blockchain
 * @param collectionAddress - Contract address to check
 * @returns True if contract supports IERC2981 interface
 */
export async function supportsEIP2981(
  publicClient: any,
  collectionAddress: Address
): Promise<boolean> {
  try {
    // IERC2981 interface ID: bytes4(keccak256("royaltyInfo(uint256,uint256)")) = 0x2a55205a
    const IERC2981_INTERFACE_ID = "0x2a55205a";
    
    const supports = await publicClient.readContract({
      address: collectionAddress,
      abi: EIP2981_ROYALTY_ABI,
      functionName: "supportsInterface",
      args: [IERC2981_INTERFACE_ID],
    });

    return supports as boolean;
  } catch (error) {
    serverLogger.warn("Error checking EIP-2981 support:", error);
    return false;
  }
}

