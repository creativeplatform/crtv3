import { MeTokenData, MeTokenInfo } from '@/lib/hooks/metokens/useMeTokensSupabase';
import { publicClient } from '@/lib/viem';
import { parseAbi } from 'viem';
import { logger } from '@/lib/utils/logger';
import { METOKEN_DIAMOND_BASE } from '@/lib/contracts/metokens/deployments';

// Base mainnet Diamond contract address
const DIAMOND_ADDRESS = METOKEN_DIAMOND_BASE;

// Diamond contract ABI for getMeTokenInfo function
const DIAMOND_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "meToken",
        "type": "address"
      }
    ],
    "name": "getMeTokenInfo",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "hubId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "balancePooled",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "balanceLocked",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "startTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "endTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "endCooldown",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "targetHubId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "migration",
            "type": "address"
          }
        ],
        "internalType": "struct MeTokenInfo",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

/**
 * Check if a MeToken is subscribed to a hub
 * A MeToken is considered subscribed if it has balancePooled > 0 or balanceLocked > 0
 */
export function isMeTokenSubscribed(meToken: MeTokenData | MeTokenInfo): boolean {
  const balancePooled = 'balancePooled' in meToken ? meToken.balancePooled : BigInt((meToken as MeTokenInfo).balancePooled || '0');
  const balanceLocked = 'balanceLocked' in meToken ? meToken.balanceLocked : BigInt((meToken as MeTokenInfo).balanceLocked || '0');

  return balancePooled > BigInt(0) || balanceLocked > BigInt(0);
}

/**
 * Check if a MeToken is NOT subscribed to a hub
 */
export function isMeTokenNotSubscribed(meToken: MeTokenData | MeTokenInfo): boolean {
  return !isMeTokenSubscribed(meToken);
}

/**
 * Get subscription status as a string
 */
export function getMeTokenSubscriptionStatus(meToken: MeTokenData | MeTokenInfo): 'subscribed' | 'not-subscribed' {
  return isMeTokenSubscribed(meToken) ? 'subscribed' : 'not-subscribed';
}

/**
 * Get detailed subscription information
 */
export function getMeTokenSubscriptionDetails(meToken: MeTokenData | MeTokenInfo) {
  const balancePooled = 'balancePooled' in meToken ? meToken.balancePooled : BigInt((meToken as MeTokenInfo).balancePooled || '0');
  const balanceLocked = 'balanceLocked' in meToken ? meToken.balanceLocked : BigInt((meToken as MeTokenInfo).balanceLocked || '0');
  const hubId = 'hubId' in meToken ? meToken.hubId : BigInt((meToken as MeTokenInfo).hubId || '0');

  const isSubscribed = balancePooled > BigInt(0) || balanceLocked > BigInt(0);

  return {
    isSubscribed,
    status: isSubscribed ? 'subscribed' : 'not-subscribed',
    balancePooled: balancePooled.toString(),
    balanceLocked: balanceLocked.toString(),
    hubId: hubId.toString(),
    totalLocked: balancePooled + balanceLocked,
    canTrade: isSubscribed,
    requiresSubscription: !isSubscribed
  };
}

/**
 * Check if a MeToken needs to be subscribed before trading
 */
export function requiresSubscriptionForTrading(meToken: MeTokenData | MeTokenInfo): boolean {
  return isMeTokenNotSubscribed(meToken);
}

/**
 * Get subscription requirements message
 */
export function getSubscriptionRequirementsMessage(meToken: MeTokenData | MeTokenInfo): string {
  if (isMeTokenSubscribed(meToken)) {
    return 'MeToken is subscribed and ready for trading.';
  }

  return 'MeToken must be subscribed to a hub before trading is enabled. Please subscribe your MeToken first.';
}

/**
 * Check MeToken subscription status directly from blockchain
 * @param meTokenAddress - The MeToken contract address
 * @returns Subscription status information
 */
export async function checkMeTokenSubscriptionFromBlockchain(meTokenAddress: string): Promise<{
  isSubscribed: boolean;
  status: 'subscribed' | 'not-subscribed';
  balancePooled: string;
  balanceLocked: string;
  hubId: string;
  totalLocked: string;
  canTrade: boolean;
  requiresSubscription: boolean;
  error?: string;
}> {
  try {
    logger.debug('🔍 Checking MeToken subscription status for:', meTokenAddress);

    // Use the standardized ABI from contracts
    const { METOKEN_ABI } = await import('@/lib/contracts/MeToken');

    let meTokenInfo: any = null;

    try {
      logger.debug('🔍 Fetching getMeTokenInfo from Diamond...');
      meTokenInfo = await publicClient.readContract({
        address: DIAMOND_ADDRESS,
        abi: METOKEN_ABI,
        functionName: 'getMeTokenInfo',
        args: [meTokenAddress as `0x${string}`]
      });
      logger.debug('✅ getMeTokenInfo succeeded:', meTokenInfo);
    } catch (err) {
      logger.warn('❌ getMeTokenInfo failed with standard ABI:', err instanceof Error ? err.message : 'Unknown error');

      // Fallback: Check if MeToken exists and return safe defaults if we can't read subscription info
      // This handles cases where the contract exists but might not be fully registered or ABI issues persist
      logger.debug('🔍 Fallback: Checking if MeToken contract code exists...');
      const code = await publicClient.getCode({
        address: meTokenAddress as `0x${string}`
      });

      if (!code || code === '0x') {
        throw new Error('MeToken contract does not exist');
      }

      logger.debug('✅ MeToken code exists, returning default unsubscribed state');
      // Return a default structure indicating existence but no subscription info
      // [owner, hubId, balancePooled, balanceLocked, startTime, endTime, targetHubId, migration]
      // Note: standard ABI returns 8 components (no endCooldown)
      meTokenInfo = [
        '0x0000000000000000000000000000000000000000', // owner
        BigInt(0), // hubId
        BigInt(0), // balancePooled
        BigInt(0), // balanceLocked
        BigInt(0), // startTime
        BigInt(0), // endTime
        BigInt(0), // targetHubId
        '0x0000000000000000000000000000000000000000'  // migration
      ];
    }

    // If all approaches failed (meTokenInfo is still null), return error state
    if (!meTokenInfo) {
      logger.error('❌ Failed to retrieve MeToken info');
      return {
        isSubscribed: false,
        status: 'not-subscribed',
        balancePooled: '0',
        balanceLocked: '0',
        hubId: '0',
        totalLocked: '0',
        canTrade: false,
        requiresSubscription: true,
        error: 'Unable to query MeToken info'
      };
    }

    // Check if this is the fallback result (all zeros/unknown values)
    const isFallbackResult = meTokenInfo[1] === BigInt(0) && meTokenInfo[2] === BigInt(0) && meTokenInfo[3] === BigInt(0);

    if (isFallbackResult) {
      logger.debug('Using fallback result - MeToken exists but subscription info not available via Diamond contract');
      return {
        isSubscribed: false,
        status: 'not-subscribed',
        balancePooled: '0',
        balanceLocked: '0',
        hubId: '0',
        totalLocked: '0',
        canTrade: false,
        requiresSubscription: true,
        error: 'MeToken exists but subscription status could not be determined. ' +
          'The Diamond contract function may not be available or the MeToken may not be properly registered.'
      };
    }

    // Normalize the result to variables
    let owner: string;
    let hubId: bigint;
    let balancePooled: bigint;
    let balanceLocked: bigint;
    let startTime: bigint;
    let endTime: bigint;
    let endCooldown: bigint = BigInt(0);
    let targetHubId: bigint;
    let migration: string;

    if (Array.isArray(meTokenInfo)) {
      // Handle array format (likely 8 elements from standard ABI, but checking length just in case)
      if (meTokenInfo.length === 8) {
        [owner, hubId, balancePooled, balanceLocked, startTime, endTime, targetHubId, migration] = meTokenInfo;
        endCooldown = BigInt(0); // Set default for missing field
      } else if (meTokenInfo.length >= 9) {
        [owner, hubId, balancePooled, balanceLocked, startTime, endTime, endCooldown, targetHubId, migration] = meTokenInfo;
      } else {
        // Fallback for unexpected length, try to map indices safely
        owner = meTokenInfo[0] || '0x0000000000000000000000000000000000000000';
        hubId = meTokenInfo[1] || BigInt(0);
        balancePooled = meTokenInfo[2] || BigInt(0);
        balanceLocked = meTokenInfo[3] || BigInt(0);
        startTime = meTokenInfo[4] || BigInt(0);
        endTime = meTokenInfo[5] || BigInt(0);
        // Skip endCooldown if 8 elements
        targetHubId = meTokenInfo[6] || BigInt(0);
        migration = meTokenInfo[7] || '0x0000000000000000000000000000000000000000';
      }
    } else {
      // Handle struct object format
      owner = meTokenInfo.owner ?? '0x0000000000000000000000000000000000000000';
      hubId = meTokenInfo.hubId ?? BigInt(0);
      balancePooled = meTokenInfo.balancePooled ?? BigInt(0);
      balanceLocked = meTokenInfo.balanceLocked ?? BigInt(0);
      startTime = meTokenInfo.startTime ?? BigInt(0);
      endTime = meTokenInfo.endTime ?? BigInt(0);
      endCooldown = meTokenInfo.endCooldown ?? BigInt(0);
      targetHubId = meTokenInfo.targetHubId ?? BigInt(0);
      migration = meTokenInfo.migration ?? '0x0000000000000000000000000000000000000000';
    }

    const isSubscribed = balancePooled > BigInt(0) || balanceLocked > BigInt(0);
    const totalLocked = balancePooled + balanceLocked;

    logger.debug('📊 Subscription status:', {
      isSubscribed,
      balancePooled: balancePooled.toString(),
      balanceLocked: balanceLocked.toString(),
      hubId: hubId.toString(),
      totalLocked: totalLocked.toString()
    });

    return {
      isSubscribed,
      status: isSubscribed ? 'subscribed' : 'not-subscribed',
      balancePooled: balancePooled.toString(),
      balanceLocked: balanceLocked.toString(),
      hubId: hubId.toString(),
      totalLocked: totalLocked.toString(),
      canTrade: isSubscribed,
      requiresSubscription: !isSubscribed
    };
  } catch (error) {
    logger.error('❌ Failed to check MeToken subscription status:', error);
    return {
      isSubscribed: false,
      status: 'not-subscribed',
      balancePooled: '0',
      balanceLocked: '0',
      hubId: '0',
      totalLocked: '0',
      canTrade: false,
      requiresSubscription: true,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Get comprehensive MeToken subscription information
 * @param meTokenAddress - The MeToken contract address
 * @returns Comprehensive subscription information including blockchain data
 */
export async function getMeTokenSubscriptionInfo(meTokenAddress: string): Promise<{
  address: string;
  subscriptionStatus: {
    isSubscribed: boolean;
    status: 'subscribed' | 'not-subscribed';
    balancePooled: string;
    balanceLocked: string;
    hubId: string;
    totalLocked: string;
    canTrade: boolean;
    requiresSubscription: boolean;
  };
  basicInfo?: {
    name: string;
    symbol: string;
    totalSupply: string;
    owner: string;
  };
  error?: string;
}> {
  try {
    logger.debug('🔍 Getting comprehensive MeToken subscription info for:', meTokenAddress);

    // Check subscription status from blockchain
    const subscriptionStatus = await checkMeTokenSubscriptionFromBlockchain(meTokenAddress);

    // Get basic token info
    let basicInfo;
    try {
      const { getMeTokenInfoFromBlockchain } = await import('@/lib/utils/metokenUtils');
      basicInfo = await getMeTokenInfoFromBlockchain(meTokenAddress);
    } catch (err) {
      logger.warn('Failed to get basic MeToken info:', err);
    }

    return {
      address: meTokenAddress,
      subscriptionStatus,
      basicInfo: basicInfo || undefined,
      error: subscriptionStatus.error
    };
  } catch (error) {
    logger.error('❌ Failed to get MeToken subscription info:', error);
    return {
      address: meTokenAddress,
      subscriptionStatus: {
        isSubscribed: false,
        status: 'not-subscribed',
        balancePooled: '0',
        balanceLocked: '0',
        hubId: '0',
        totalLocked: '0',
        canTrade: false,
        requiresSubscription: true
      },
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Get the vault address for a specific Hub ID
 * @param hubId - The Hub ID to get the vault for
 * @returns The vault address
 */
export async function getHubVaultAddress(hubId: bigint | number): Promise<string> {
  try {
    logger.debug(`🔍 fetching Vault address for Hub ${hubId}...`);

    // Default to Hub 1 if invalid
    const cleanHubId = hubId ? BigInt(hubId) : BigInt(1);

    // Use JSON ABI syntax matching viem requirements
    const HUB_ABI = [
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "hubId",
            "type": "uint256"
          }
        ],
        "name": "getHubInfo",
        "outputs": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "startTime",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "endTime",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "endCooldown",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "refundRatio",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "targetRefundRatio",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "owner",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "vault",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "asset",
                "type": "address"
              },
              {
                "internalType": "bool",
                "name": "updating",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "reconfigure",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "active",
                "type": "bool"
              }
            ],
            "internalType": "struct LibHub.HubInfo",
            "name": "hubInfo",
            "type": "tuple"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ] as const;

    const hubInfo = await publicClient.readContract({
      address: DIAMOND_ADDRESS,
      abi: HUB_ABI,
      functionName: 'getHubInfo',
      args: [cleanHubId]
    }) as any;

    if (!hubInfo) {
      throw new Error(`Hub ${cleanHubId} not found`);
    }

    // Extract vault address from the tuple/struct
    // The struct structure is:
    // [startTime, endTime, endCooldown, refundRatio, targetRefundRatio, owner, vault, asset, updating, reconfigure, active]
    // Vault is at index 6

    let vaultAddress: string;

    if (Array.isArray(hubInfo)) {
      vaultAddress = hubInfo[6] as string;
    } else if (typeof hubInfo === 'object' && 'vault' in hubInfo) {
      vaultAddress = hubInfo.vault as string;
    } else {
      logger.warn('⚠️ Unexpected hubInfo format:', hubInfo);
      // Fallback: try to access by index if it's an object behaving like array
      vaultAddress = (hubInfo as any)[6] || (hubInfo as any).vault;
    }

    if (!vaultAddress || vaultAddress === '0x0000000000000000000000000000000000000000') {
      logger.warn(`⚠️ Vault address for Hub ${cleanHubId} is zero address`);
      return DIAMOND_ADDRESS; // Fallback to Diamond if vault is missing (should verify this behavior)
    }

    logger.debug(`✅ Vault address for Hub ${cleanHubId}:`, vaultAddress);
    return vaultAddress;
  } catch (error) {
    logger.error(`❌ Failed to get vault address:`, error);
    // Fallback to Diamond address to assume it's the spender if we fail (safe default for legacy behavior)
    return DIAMOND_ADDRESS;
  }
}
