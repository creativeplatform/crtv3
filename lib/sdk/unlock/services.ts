// services/unlock.ts
import { Web3Service } from "@unlock-protocol/unlock-js";
import PublicLockV14Json from "@unlock-protocol/contracts/dist/abis/PublicLock/PublicLockV14.json";
import {
  type PublicClient,
  createPublicClient,
  getContract,
  http,
  type GetContractReturnType,
} from "viem";
import { base } from "@account-kit/infra";
import { parseIpfsUriWithFallback } from "@/lib/utils/image-gateway";
import { serverLogger } from "@/lib/utils/logger";

/** Resolve Base mainnet RPC URL. Avoids Alchemy client when key is missing (returns non-JSON → parse error). */
function getBaseRpcUrl(): string {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  // Only use Alchemy URL if we have a valid, non-empty API key
  if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
    const trimmedKey = apiKey.trim();
    // Ensure the URL includes the API key
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${trimmedKey}`;
    serverLogger.debug('[RPC] Using Alchemy RPC with API key');
    return alchemyUrl;
  }

  // Fallback to other RPC URLs if Alchemy key is missing
  const alchemyRpc = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  if (alchemyRpc && typeof alchemyRpc === 'string' && alchemyRpc.trim().length > 0) {
    serverLogger.debug('[RPC] Using NEXT_PUBLIC_ALCHEMY_RPC_URL');
    return alchemyRpc.trim();
  }

  const baseRpc = process.env.NEXT_PUBLIC_BASE_RPC_URL;
  if (baseRpc && typeof baseRpc === 'string' && baseRpc.trim().length > 0) {
    serverLogger.debug('[RPC] Using NEXT_PUBLIC_BASE_RPC_URL');
    return baseRpc.trim();
  }

  // Final fallback to public Base RPC
  serverLogger.warn('[RPC] No Alchemy API key found, falling back to public Base RPC');
  return "https://mainnet.base.org";
}

const baseRpcUrl = getBaseRpcUrl();
serverLogger.debug('[RPC] Base RPC URL configured:', baseRpcUrl.replace(/\/v2\/[^/]+/, '/v2/***'));

const accountKitClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
});

// Use the official PublicLockV14 ABI from Unlock Protocol
const lockAbi = PublicLockV14Json.abi;

// Create a Viem-based provider for Web3Service
const provider = {
  async request(args: { method: string; params?: any[] }) {
    try {
      // @ts-ignore - client.request is typed differently but compatible
      return await accountKitClient.request(args);
    } catch (error) {
      serverLogger.error("Provider request error:", error);
      throw error;
    }
  },
};

// Initialize Web3Service with Base chain configuration
const networks = {
  [base.id]: {
    provider,
    id: base.id,
    name: base.name,
    unlockAddress: "0xc0b4159e91e1f9f8adf1d3a9dd1d672c9d0c3f5f",
    publicLockLatestVersion: 14,
  },
  1: {
    unlockAddress: "0x3d5409cce1d45233de1d4ebdee74b8e004abdd13", // Mainnet
    provider: "https://rpc.unlock-protocol.com/1",
  },
  5: {
    unlockAddress: "0x627118a4fB747016911e5cDA82e2E77C531e8206", // Goerli
    provider: "https://rpc.unlock-protocol.com/5",
  },
  // Add other networks as needed
};

const web3Service = new Web3Service(networks);

// Lock addresses configuration
export const LOCK_ADDRESSES = {
  BASE_CREATIVE_PASS: "0xf7c4cd399395d80f9d61fde833849106775269c6",
  BASE_CREATIVE_PASS_2: "0x13b818daf7016b302383737ba60c3a39fef231cf",
  BASE_CREATIVE_PASS_3: "0x9c3744c96200a52d05a630d4aec0db707d7509be",
  BASE_CREATIVE_CREATOR_PLUS: "0x53b6309049420ce56df5b8ece17965ca9e4274a7",
  BASE_CREATIVE_INVESTOR_PLUS: "0xeee108b671ba14f073747edd57f0b1cbcd514d9e",
  BASE_CREATIVE_BRAND_PLUS: "0xbf6a250c93c2eee024d603209967a3ea30d88d44",
} as const;

// Maximum number of NFTs per tier/lock that can be held in any wallet
export const MAX_NFTS_PER_TIER = 4;

export type LockAddress = keyof typeof LOCK_ADDRESSES;
export type LockAddressValue = (typeof LOCK_ADDRESSES)[LockAddress];

export interface LockMetadata {
  name: string;
  description: string;
  image: string;
  externalUrl?: string;
  version?: number;
}

export interface KeyMetadata {
  tokenId: string;
  expiration: number;
  owner: string;
}

export interface MembershipError extends Error {
  code: string;
  context?: Record<string, unknown>;
}

type PublicLockContract = GetContractReturnType<typeof lockAbi, PublicClient>;

export class UnlockService {
  private client: PublicClient;

  constructor() {
    this.client = accountKitClient;
  }

  private createError(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ) {
    return {
      message,
      code,
      details,
    };
  }

  private getContract(lockAddress: string): PublicLockContract {
    return getContract({
      address: lockAddress as `0x${string}`,
      abi: lockAbi,
      client: this.client,
    });
  }

  private async checkBalanceOf(
    lockAddress: string,
    userAddress: string
  ): Promise<boolean> {
    try {
      serverLogger.debug("Checking balance with chain:", {
        id: this.client.chain?.id,
        name: this.client.chain?.name,
      });

      const contract = this.getContract(lockAddress);

      // Use balanceOf as a quick check
      const balanceResult = await contract.read.balanceOf([
        userAddress as `0x${string}`,
      ]);
      const balance = BigInt(String(balanceResult));

      const hasBalance = balance > 0n;
      serverLogger.debug("Balance check result:", {
        balance: balance.toString(),
        hasBalance,
      });

      return hasBalance;
    } catch (error) {
      serverLogger.error("Error checking balance:", error);
      throw this.createError(
        `Failed to check balance: ${(error as Error).message}`,
        "BALANCE_CHECK_ERROR",
        { lockAddress, userAddress, originalError: error }
      );
    }
  }

  private async getTokensOfOwner(
    lockAddress: string,
    userAddress: string
  ): Promise<bigint[]> {
    try {
      const contract = this.getContract(lockAddress);

      // Get balance of tokens
      const balanceResult = await contract.read.balanceOf([
        userAddress as `0x${string}`,
      ]);
      const balance = BigInt(String(balanceResult));

      if (balance === 0n) {
        serverLogger.debug("No tokens found for user");
        return [];
      }

      serverLogger.debug(
        `Balance for ${userAddress} at ${lockAddress}:`,
        balance.toString()
      );

      // Get all token IDs using tokenOfOwnerByIndex
      const tokenIds: bigint[] = [];
      for (let i = 0n; i < balance; i++) {
        try {
          const tokenId = await contract.read.tokenOfOwnerByIndex([
            userAddress as `0x${string}`,
            i,
          ]);
          tokenIds.push(BigInt(String(tokenId)));
        } catch (error) {
          serverLogger.warn(`Error getting token at index ${i}:`, error);
          // Continue to next token
        }
      }

      return tokenIds;
    } catch (error) {
      serverLogger.error(
        `Error getting tokens for ${userAddress} at ${lockAddress}:`,
        error
      );
      throw this.createError(
        `Failed to get tokens: ${(error as Error).message}`,
        "TOKEN_FETCH_ERROR",
        { lockAddress, userAddress, originalError: error }
      );
    }
  }

  async getNftMetadata(
    lockAddress: string,
    tokenId: string
  ): Promise<LockMetadata | null> {
    try {
      const contract = this.getContract(lockAddress);

      // Get the token URI
      const result = await contract.read.tokenURI([BigInt(tokenId)]);
      // The result should be a string, but let's handle it safely
      const tokenUri =
        result && typeof result === "object" && Array.isArray(result)
          ? result[0]?.toString()
          : String(result);

      // Validate that tokenUri is a non-empty string
      if (!tokenUri || typeof tokenUri !== 'string') {
        serverLogger.warn(
          `No tokenURI found for token ${tokenId} at ${lockAddress}`
        );
        return null;
      }

      // Convert IPFS URI to HTTP gateway URL if needed
      const httpTokenUri = parseIpfsUriWithFallback(tokenUri);

      // Fetch metadata from the token URI
      const response = await fetch(httpTokenUri);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const metadata = await response.json();

      // Convert IPFS image URL to HTTP gateway URL if needed
      // Validate that image is a string before processing
      const imageUrl = metadata.image && typeof metadata.image === 'string'
        ? parseIpfsUriWithFallback(metadata.image)
        : "";

      // Validate that external_url is a string before processing
      const externalUrl = metadata.external_url && typeof metadata.external_url === 'string'
        ? parseIpfsUriWithFallback(metadata.external_url)
        : undefined;

      return {
        name: metadata.name || "",
        description: metadata.description || "",
        image: imageUrl,
        externalUrl,
      };
    } catch (error) {
      serverLogger.error(
        `Error fetching NFT metadata for token ${tokenId} at ${lockAddress}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get lock details including metadata
   */
  async getLock(lockAddress: string) {
    try {
      const contract = this.getContract(lockAddress);

      // Get basic lock details from the contract
      // You can add more contract calls here as needed
      return {
        address: lockAddress,
        // Add other lock details as needed
      };
    } catch (error) {
      serverLogger.error(`Error getting lock details for ${lockAddress}:`, error);
      throw this.createError(
        `Failed to get lock details: ${(error as Error).message}`,
        "LOCK_FETCH_ERROR",
        { lockAddress, originalError: error }
      );
    }
  }

  /**
   * Check if an address has a valid membership
   */
  async hasValidMembership(
    lockAddress: string,
    userAddress: string
  ): Promise<boolean> {
    try {
      serverLogger.debug(
        `Checking membership for ${userAddress} at lock ${lockAddress}`
      );

      const contract = this.getContract(lockAddress);

      // Use getHasValidKey which internally checks expiration and validity
      const hasValidKeyResult = await contract.read.getHasValidKey([
        userAddress as `0x${string}`,
      ]);
      const hasValidKey = Boolean(hasValidKeyResult);

      serverLogger.debug("getHasValidKey result:", hasValidKey);

      return hasValidKey;
    } catch (error) {
      const errorMessage = (error as Error).message || String(error);

      // Check for RPC configuration errors
      if (
        errorMessage.includes('Unexpected token') ||
        errorMessage.includes('Unspecifie') ||
        errorMessage.includes('not valid JSON') ||
        (errorMessage.includes('HTTP request failed') && errorMessage.includes('base-mainnet.g.alchemy.com'))
      ) {
        serverLogger.error(
          `RPC configuration error when checking membership for ${userAddress} at ${lockAddress}:`,
          error
        );
        throw this.createError(
          `RPC configuration error: Alchemy API key may be missing or invalid. Please check NEXT_PUBLIC_ALCHEMY_API_KEY environment variable.`,
          "RPC_CONFIG_ERROR",
          {
            lockAddress,
            userAddress,
            originalError: error,
            rpcUrl: baseRpcUrl.replace(/\/v2\/[^/]+/, '/v2/***')
          }
        );
      }

      serverLogger.error(
        `Error checking membership for ${userAddress} at ${lockAddress}:`,
        error
      );
      throw this.createError(
        `Failed to check membership: ${errorMessage}`,
        "MEMBERSHIP_CHECK_ERROR",
        { lockAddress, userAddress, originalError: error }
      );
    }
  }

  /**
   * Get all membership NFTs with token IDs for an address
   */
  async getAllMembershipNFTs(userAddress: string) {
    serverLogger.debug("Getting all membership NFTs for address:", userAddress);

    if (!userAddress) {
      throw this.createError("User address is required", "INVALID_ADDRESS", {
        userAddress,
      });
    }

    const membershipNFTs: Array<{
      lockName: LockAddress;
      lockAddress: string;
      tokenId: string;
      metadata: LockMetadata | null;
    }> = [];

    await Promise.all(
      Object.entries(LOCK_ADDRESSES).map(async ([name, address]) => {
        try {
          const tokens = await this.getTokensOfOwner(address, userAddress);

          // Limit to maximum of 4 NFTs per tier/lock
          const limitedTokens = tokens.slice(0, MAX_NFTS_PER_TIER);

          for (const tokenId of limitedTokens) {
            let metadata = null;
            try {
              metadata = await this.getNftMetadata(address, tokenId.toString());
            } catch (error) {
              serverLogger.warn(
                `Failed to get metadata for token ${tokenId} at ${address}:`,
                error
              );
            }

            membershipNFTs.push({
              lockName: name as LockAddress,
              lockAddress: address,
              tokenId: tokenId.toString(),
              metadata,
            });
          }
        } catch (error) {
          serverLogger.error(
            `Error getting membership NFTs for ${address}:`,
            error
          );
        }
      })
    );

    return membershipNFTs;
  }

  /**
   * Get all memberships for an address across multiple locks
   */
  async getAllMemberships(userAddress: string) {
    serverLogger.debug("Getting all memberships for address:", userAddress);

    if (!userAddress) {
      throw this.createError("User address is required", "INVALID_ADDRESS", {
        userAddress,
      });
    }

    const memberships = await Promise.all(
      Object.entries(LOCK_ADDRESSES).map(async ([name, address]) => {
        try {
          serverLogger.debug(`Checking lock ${name} at ${address}`);
          const hasValid = await this.hasValidMembership(address, userAddress);

          // Only fetch lock details if membership is valid
          let lock = null;
          let tokenId = null;
          let metadata = null;
          let expiration: number | undefined;

          if (hasValid) {
            try {
              // Get lock details
              lock = await this.getLock(address);

              // Get token IDs for the user
              const tokens = await this.getTokensOfOwner(address, userAddress);

              if (tokens.length > 0) {
                // Return all token IDs, not just the first one
                // The caller can use any of them
                tokenId = tokens[0].toString();
                // Get metadata for the first token
                metadata = await this.getNftMetadata(address, tokenId);

                try {
                  const contract = this.getContract(address);
                  // Get expiration for the token
                  const expirationResult = await contract.read.keyExpirationTimestampFor([BigInt(tokenId)]);
                  expiration = Number(expirationResult);
                } catch (e) {
                  serverLogger.warn(`Failed to get expiration for token ${tokenId} at ${address}`, e);
                }

                if (metadata) {
                  lock = {
                    ...lock,
                    ...metadata,
                  };
                }
              }
            } catch (error) {
              serverLogger.warn(
                `Failed to get complete lock details for ${address}, continuing with basic membership info:`,
                error
              );
            }
          }

          serverLogger.debug(`Lock ${name} valid:`, hasValid);

          return {
            name: name as LockAddress,
            address,
            isValid: hasValid,
            lock,
            tokenId,
            expiration,
          };
        } catch (error) {
          serverLogger.error(
            `Error getting membership details for ${address}:`,
            error
          );
          return {
            name: name as LockAddress,
            address,
            isValid: false,
            lock: null,
            tokenId: null,
          };
        }
      })
    );

    serverLogger.debug("All memberships:", memberships);
    return memberships;
  }
}

// Export singleton instance
export const unlockService = new UnlockService();

export interface FetchLockAndKeyParams {
  lockAddress: string;
  userAddress: string;
  network: number;
}

export async function fetchLockAndKey({
  lockAddress,
  userAddress,
  network,
}: FetchLockAndKeyParams) {
  const web3Service = new Web3Service(networks);
  // Fetch lock details
  const lock = await web3Service.getLock(lockAddress, network);
  // Fetch key (NFT) for user
  const key = await web3Service.getKeyByLockForOwner(
    lockAddress,
    userAddress,
    network
  );
  return { lock, key };
}
