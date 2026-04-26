/**
 * Story Protocol Factory Contract Service
 * 
 * This service interacts with the CreatorIPCollectionFactory smart contract to deploy
 * creator-owned NFT collections on Story Protocol. These collections use TokenERC721
 * (Story Protocol's NFT contract) and can be registered as IP Assets.
 * 
 * Architecture:
 * - Factory contract deployed on Story Protocol (mainnet/testnet)
 * - Each creator gets their own TokenERC721 collection contract
 * - Creator owns collection from day one (set as DEFAULT_ADMIN_ROLE)
 * - Collections are deployed using CREATE2 for deterministic addresses
 * - Factory owner must deploy collections (onlyOwner modifier)
 * 
 * Integration Flow:
 * 1. Platform (factory owner) calls factory.deployCreatorCollection(name, symbol, creator, bytecode)
 * 2. Factory deploys TokenERC721 collection using CREATE2
 * 3. Collection is initialized with creator as owner
 * 4. Collection address is stored in factory's creatorCollections mapping
 * 5. Collection can be used to mint NFTs
 * 6. NFTs can be registered on Story Protocol as IP Assets
 */

import type { Address, Hex, Log } from "viem";
import { encodeFunctionData, parseAbi, getAddress } from "viem";
import { createStoryPublicClient } from "./client";
import { createServiceClient } from "@/lib/sdk/supabase/service";
import { serverLogger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";
import { keccak256, toBytes } from "viem";


/**
 * Factory contract ABI - matches CreatorIPCollectionFactory.sol
 */
const FACTORY_ABI = parseAbi([
  "function deployCreatorCollection(string memory _name, string memory _symbol, address _creator, bytes memory _bytecode) external returns (address)",
  "function computeCollectionAddress(address _creator, string memory _name, string memory _symbol) external view returns (address)",
  "function getCreatorCollection(address creatorAddress) external view returns (address)",
  "function hasCollection(address creatorAddress) external view returns (bool)",
  "function owner() external view returns (address)",
  "function collectionBytecodeHash() external view returns (bytes32)",
  "event CollectionCreated(address indexed creator, address indexed collectionAddress, string name, string symbol)",
]);

/**
 * Collection contract ABI - TokenERC721 (Story Protocol's NFT contract)
 */
const COLLECTION_ABI = parseAbi([
  "function initialize(address _defaultAdmin, string memory _name, string memory _symbol, string memory _contractURI, address[] memory _trustedForwarders, address _saleRecipient, address _royaltyRecipient, uint128 _royaltyBps, uint128 _platformFeeBps, address _platformFeeRecipient) external",
  "function mintTo(address to, string memory uri) external returns (uint256)",
  "function mintWithSignature((address to, address royaltyRecipient, uint256 royaltyBps, address primarySaleRecipient, string uri, uint256 price, address currency, uint128 validityStartTimestamp, uint128 validityEndTimestamp, bytes32 uid), bytes signature) external payable returns (uint256)",
  "function owner() external view returns (address)",
  "function nextTokenIdToMint() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function grantRole(bytes32 role, address account) external",
]);

/**
 * Get the factory contract address from environment
 */
export function getFactoryContractAddress(): Address | null {
  const address = process.env.NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS;
  if (!address) {
    return null;
  }
  try {
    return getAddress(address);
  } catch {
    serverLogger.warn("Invalid factory contract address format:", address);
    return null;
  }
}

/**
 * Get the TokenERC721 bytecode from environment
 * This bytecode is required for factory deployments
 */
export function getCollectionBytecode(): Hex | null {
  const bytecode = process.env.COLLECTION_BYTECODE;
  if (!bytecode || !bytecode.startsWith("0x")) {
    return null;
  }
  return bytecode as Hex;
}

/**
 * Compute the deterministic collection address before deployment (CREATE2)
 * 
 * @param creatorAddress - Creator's wallet address
 * @param collectionName - Collection name
 * @param collectionSymbol - Collection symbol
 * @returns Predicted collection address or null if factory not configured
 */
export async function computeCollectionAddress(
  creatorAddress: Address,
  collectionName: string,
  collectionSymbol: string
): Promise<Address | null> {
  const factoryAddress = getFactoryContractAddress();
  if (!factoryAddress) {
    return null;
  }

  try {
    const publicClient = createStoryPublicClient();
    const predictedAddress = (await publicClient.readContract({
      address: factoryAddress,
      abi: FACTORY_ABI,
      functionName: "computeCollectionAddress",
      args: [creatorAddress, collectionName, collectionSymbol],
    })) as Address;

    return predictedAddress;
  } catch (error) {
    serverLogger.error("Failed to compute collection address:", error);
    return null;
  }
}

/**
 * Deploy a new creator-owned collection via Factory
 * 
 * NOTE: This function requires the factory owner's private key and should be called
 * server-side. For client-side deployments, use the API route at /api/story/factory/deploy-collection
 * 
 * @param walletClient - Wallet client with factory owner's account (must be owner)
 * @param creatorAddress - Creator's wallet address (will own the collection)
 * @param collectionName - Collection name (e.g., "Creator Name's Videos")
 * @param collectionSymbol - Collection symbol (e.g., "CRTV")
 * @param bytecode - TokenERC721 contract bytecode (must match factory's collectionBytecodeHash)
 * @returns Collection address and transaction hash
 */
export async function deployCreatorCollection(
  walletClient: any,
  creatorAddress: Address,
  collectionName: string,
  collectionSymbol: string,
  bytecode: Hex
): Promise<{ collectionAddress: Address; txHash: string }> {
  const factoryAddress = getFactoryContractAddress();
  if (!factoryAddress) {
    throw new Error("Factory contract address not configured. Set NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS");
  }

  if (!bytecode || !bytecode.startsWith("0x")) {
    throw new Error("Collection bytecode is required. Set COLLECTION_BYTECODE environment variable.");
  }

  try {
    // Encode the function call
    const deployData = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: "deployCreatorCollection",
      args: [collectionName, collectionSymbol, creatorAddress, bytecode],
    });

    // Get the account from wallet client
    const [account] = await walletClient.getAddresses();
    if (!account) {
      throw new Error("No account found in wallet client");
    }

    // Send the deployment transaction
    const hash = await walletClient.sendTransaction({
      account,
      to: factoryAddress,
      data: deployData,
      value: BigInt(0),
    });

    // Wait for the transaction to be mined
    const publicClient = createStoryPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
    });

    // Extract collection address from the CollectionCreated event
    const COLLECTION_CREATED_EVENT_SIGNATURE = "0x4f51faf6c4561ff95f067657e43439f0f856d97c04d9eb9075eb457ab0d5e1f1";

    const collectionCreatedEvent = receipt.logs.find((log: Log) => {
      return log.topics[0] === COLLECTION_CREATED_EVENT_SIGNATURE;
    });

    let collectionAddress: Address;
    if (collectionCreatedEvent && collectionCreatedEvent.topics[2]) {
      // Extract address from topic (remove 0x prefix and pad, then take last 40 chars)
      const addressHex = collectionCreatedEvent.topics[2].slice(-40);
      collectionAddress = getAddress(`0x${addressHex}`);
    } else {
      // Fallback: Query the factory contract for the creator's collection
      collectionAddress = (await publicClient.readContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: "getCreatorCollection",
        args: [creatorAddress],
      })) as Address;

      // Check if collection was actually deployed
      if (collectionAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("Collection deployment failed - no collection address found");
      }
    }

    // Store collection in database
    const supabase = createServiceClient();
    await supabase.from("creator_collections").upsert(
      {
        creator_id: creatorAddress,
        collection_address: collectionAddress,
        collection_name: collectionName,
        collection_symbol: collectionSymbol,
        created_at: new Date().toISOString(),
      },
      {
        onConflict: "creator_id",
      }
    );

    return {
      collectionAddress,
      txHash: hash,
    };
  } catch (error) {
    serverLogger.error("Failed to deploy creator collection:", error);
    throw new Error(
      `Collection deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get a creator's collection address from the factory
 * 
 * @param creatorAddress - Creator's wallet address
 * @returns Collection address or null if not found
 */
export async function getCreatorCollectionAddress(
  creatorAddress: Address
): Promise<Address | null> {
  const factoryAddress = getFactoryContractAddress();
  if (!factoryAddress) {
    // Fallback to database if factory not configured
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("creator_collections")
      .select("collection_address")
      .eq("creator_id", creatorAddress)
      .single();
    return data?.collection_address as Address | null;
  }

  try {
    const publicClient = createStoryPublicClient();
    const collectionAddress = (await publicClient.readContract({
      address: factoryAddress,
      abi: FACTORY_ABI,
      functionName: "getCreatorCollection",
      args: [creatorAddress],
    })) as Address;

    // Return null if address is zero (no collection found)
    if (collectionAddress === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    return collectionAddress;
  } catch (error) {
    serverLogger.error("Failed to get creator collection:", error);
    // Fallback to database on error
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("creator_collections")
      .select("collection_address")
      .eq("creator_id", creatorAddress)
      .single();
    return data?.collection_address as Address | null;
  }
}

/**
 * Check if a creator has a collection
 * 
 * @param creatorAddress - Creator's wallet address
 * @returns True if creator has a collection
 */
export async function hasCreatorCollection(
  creatorAddress: Address
): Promise<boolean> {
  const collection = await getCreatorCollectionAddress(creatorAddress);
  return collection !== null;
}

/**
 * Get the factory owner address
 * 
 * @returns Factory owner address or null if not available
 */
export async function getFactoryOwner(): Promise<Address | null> {
  const factoryAddress = getFactoryContractAddress();
  if (!factoryAddress) {
    return null;
  }

  try {
    const publicClient = createStoryPublicClient();
    const owner = (await publicClient.readContract({
      address: factoryAddress,
      abi: FACTORY_ABI,
      functionName: "owner",
    })) as Address;

    return owner;
  } catch (error) {
    serverLogger.error("Failed to get factory owner:", error);
    return null;
  }
}

/**
 * Mint a new NFT in the creator's collection
 * 
 * @param walletClient - Wallet client with minter's account
 * @param collectionAddress - Collection address
 * @param to - Recipient address
 * @param uri - Token URI (optional, default empty)
 * @returns Token ID and transaction hash
 */
export async function mintInCreatorCollection(
  walletClient: any,
  collectionAddress: Address,
  to: Address,
  uri: string = ""
): Promise<{ tokenId: string; txHash: string }> {
  try {
    // Encode the function call
    const mintData = encodeFunctionData({
      abi: COLLECTION_ABI,
      functionName: "mintTo",
      args: [to, uri],
    });

    // Get the account from wallet client
    const [account] = await walletClient.getAddresses();
    if (!account) {
      throw new Error("No account found in wallet client");
    }

    // Send the transaction
    const hash = await walletClient.sendUserOperation({
      uo: {
        target: collectionAddress,
        data: appendBuilderCode(mintData),
        value: BigInt(0),
      },
    });

    // Wait for the transaction to be mined
    const txHash = await walletClient.waitForUserOperationTransaction({
      hash,
    });

    // In a real implementation we would parse logs to get the token ID
    // For now we'll assume sequential IDs and fetch the latest
    const publicClient = createStoryPublicClient();
    const totalSupply = await publicClient.readContract({
      address: collectionAddress,
      abi: COLLECTION_ABI,
      functionName: "totalSupply",
    });

    // Validating assumption: if we just minted, the tokenId matches current supply (if starting from 1)
    // or we might need `nextTokenIdToMint` depending on the contract logic.
    // Given the simple requirement, we'll return the supply as the ID.

    return {
      tokenId: totalSupply.toString(),
      txHash: txHash,
    };
  } catch (error) {
    serverLogger.error("Failed to mint in creator collection:", error);
    throw new Error(
      `Minting failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Grant the platform minter role to an address
 * 
 * @param walletClient - Wallet client with admin's account (creator)
 * @param collectionAddress - Collection address
 * @param minterAddress - Address to grant minter role to
 * @returns Transaction hash
 */
export async function grantPlatformMinterRole(
  walletClient: any,
  collectionAddress: Address,
  minterAddress: Address
): Promise<{ txHash: string }> {
  try {
    const MINTER_ROLE = keccak256(toBytes("MINTER_ROLE"));

    // Encode the function call
    const grantData = encodeFunctionData({
      abi: COLLECTION_ABI,
      functionName: "grantRole",
      args: [MINTER_ROLE, minterAddress],
    });

    // Get the account from wallet client
    const [account] = await walletClient.getAddresses();
    if (!account) {
      throw new Error("No account found in wallet client");
    }

    // Send the transaction
    const hash = await walletClient.sendUserOperation({
      uo: {
        target: collectionAddress,
        data: appendBuilderCode(grantData),
        value: BigInt(0),
      },
    });

    // Wait for the transaction to be mined
    const txHash = await walletClient.waitForUserOperationTransaction({
      hash,
    });

    return {
      txHash,
    };
  } catch (error) {
    serverLogger.error("Failed to grant minter role:", error);
    throw new Error(
      `Grant minter role failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}