import { useState, useEffect, useCallback } from 'react';
import { useUser, useSendUserOperation, useSmartAccountClient } from '@account-kit/react';
import { useGasSponsorship } from "@/lib/hooks/wallet/useGasSponsorship";
import { parseEther, formatEther, encodeFunctionData } from 'viem';
import { meTokensSubgraph, MeToken } from '@/lib/sdk/metokens/subgraph';
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


// MeTokens contract addresses on Base
const METOKEN_FACTORY = '0xb31Ae2583d983faa7D8C8304e6A16E414e721A0B';
const DIAMOND = '0xba5502db2aC2cBff189965e991C07109B14eB3f5';

// ABI for MeToken Factory
const METOKEN_FACTORY_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "diamond",
        "type": "address"
      }
    ],
    "name": "create",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// ABI for Diamond contract (key functions for MeTokens)
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
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "meToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "assetsDeposited",
        "type": "uint256"
      }
    ],
    "name": "calculateMeTokensMinted",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "meTokensMinted",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "meToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "meTokensBurned",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "calculateAssetsReturned",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "assetsReturned",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "meToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "assetsDeposited",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      }
    ],
    "name": "mint",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "meTokensMinted",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "meToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "meTokensBurned",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      }
    ],
    "name": "burn",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "assetsReturned",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "hubId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "assetsDeposited",
        "type": "uint256"
      }
    ],
    "name": "subscribe",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// ERC20 ABI for MeToken
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface MeTokenInfo {
  owner: string;
  hubId: bigint;
  balancePooled: bigint;
  balanceLocked: bigint;
  startTime: bigint;
  endTime: bigint;
  endCooldown: bigint;
  targetHubId: bigint;
  migration: string;
}

export interface MeTokenData {
  address: string;
  name: string;
  symbol: string;
  totalSupply: bigint;
  balance: bigint;
  info: MeTokenInfo;
  tvl: number;
}

export function useMeTokens() {
  const user = useUser();
  const { client } = useSmartAccountClient({});
  const { getGasContext } = useGasSponsorship();
  const { sendUserOperationAsync, isSendingUserOperation, error } = useSendUserOperation({ client });

  const address = user?.address;

  const [userMeToken, setUserMeToken] = useState<MeTokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [meTokenError, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Check if user has a MeToken by calling Diamond contract directly
  const checkUserMeToken = useCallback(async () => {
    if (!address || !client) return;

    setLoading(true);
    setError(null);

    try {
      // First, let's try to get MeTokens from subgraph
      const meTokens = await meTokensSubgraph.getAllMeTokens(100, 0);

      // Filter MeTokens by checking each one's owner via Diamond contract
      let userMeToken: MeTokenData | null = null;

      for (const meToken of meTokens) {
        try {
          // Get MeToken info from Diamond contract
          const info = await client.readContract({
            address: DIAMOND,
            abi: DIAMOND_ABI,
            functionName: 'getMeTokenInfo',
            args: [meToken.id as `0x${string}`],
          }) as any;

          // Check if this MeToken belongs to the current user
          if (info && info.owner.toLowerCase() === address.toLowerCase()) {
            // Get ERC20 token info
            const name = await client.readContract({
              address: meToken.id as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'name',
            }) as string;

            const symbol = await client.readContract({
              address: meToken.id as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'symbol',
            }) as string;

            const totalSupply = await client.readContract({
              address: meToken.id as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'totalSupply',
            }) as bigint;

            const balance = await client.readContract({
              address: meToken.id as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            }) as bigint;

            userMeToken = {
              address: meToken.id,
              name,
              symbol,
              totalSupply,
              balance,
              info: {
                owner: info.owner,
                hubId: info.hubId,
                balancePooled: info.balancePooled,
                balanceLocked: info.balanceLocked,
                startTime: info.startTime,
                endTime: info.endTime,
                endCooldown: info.endCooldown || BigInt(0),
                targetHubId: info.targetHubId,
                migration: info.migration,
              },
              tvl: calculateTVL({
                owner: info.owner,
                hubId: info.hubId,
                balancePooled: info.balancePooled,
                balanceLocked: info.balanceLocked,
                startTime: info.startTime,
                endTime: info.endTime,
                endCooldown: info.endCooldown || BigInt(0),
                targetHubId: info.targetHubId,
                migration: info.migration,
              }),
            };
            break; // Found the user's MeToken
          }
        } catch (err) {
          // Continue checking other MeTokens if this one fails
          logger.warn(`Failed to check MeToken ${meToken.id}:`, err);
        }
      }

      setUserMeToken(userMeToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check MeToken');
      setUserMeToken(null);
    } finally {
      setLoading(false);
    }
  }, [address, client]);

  // Create a new MeToken
  const createMeToken = async (name: string, symbol: string, hubId: number = 1, assetsDeposited: string = "0") => {
    if (!address || !user || !client) throw new Error('No wallet connected');

    setIsConfirming(false);
    setIsConfirmed(false);
    setError(null);

    // Base USDC Address
    const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    // Helper to execute the creation transaction
    const executeCreation = async (context: any) => {
      const createData = encodeFunctionData({
        abi: METOKEN_FACTORY_ABI,
        functionName: 'create',
        args: [name, symbol, DIAMOND],
      });

      const uoCallData = {
        target: METOKEN_FACTORY as `0x${string}`,
        data: createData,
        value: BigInt(0),
      };

      return await sendUserOperationAsync({
        uo: uoCallData,
        context: context,
        overrides: {
          paymasterAndData: context ? undefined : undefined,
        },
      });
    };

    try {
      setIsConfirming(true);

      // Determine gas context (Member -> Sponsored, Non-Member -> USDC)
      const gasContext = getGasContext('usdc');
      const primaryContext = gasContext.context;

      let result;

      try {
        logger.debug(`Attempting to create MeToken with ${gasContext.isSponsored ? 'Sponsored' : (primaryContext ? 'USDC' : 'Standard')} gas...`);
        result = await executeCreation(primaryContext);
      } catch (error) {
        if (primaryContext) {
          logger.warn("Primary gas payment failed, falling back to standard gas:", error);
          // Fallback to standard gas (ETH)
          result = await executeCreation(undefined);
        } else {
          throw error;
        }
      }

      if (result && (result as any).hash) {
        // Wait for transaction to be mined
        const receipt = await client.waitForUserOperationTransaction({
          hash: (result as any).hash,
        });

        setIsConfirming(false);
        setIsConfirmed(true);

        // Refresh the user's MeToken data
        await checkUserMeToken();
      }

    } catch (err) {
      setIsConfirming(false);
      setIsConfirmed(false);

      // Handle specific error cases
      if (err instanceof Error) {
        if (err.message.includes('User denied') || err.message.includes('User rejected')) {
          throw new Error('Transaction was rejected by user');
        }
        throw err;
      }
      throw new Error('Failed to create MeToken');
    }
  };

  // Get MeToken info
  const getMeTokenInfo = async (meTokenAddress: string): Promise<MeTokenInfo | null> => {
    try {
      // This would use the diamond contract to get MeToken info
      // Implementation depends on your contract setup
      return null;
    } catch (err) {
      logger.error('Failed to get MeToken info:', err);
      return null;
    }
  };

  // Calculate TVL
  const calculateTVL = (info: MeTokenInfo): number => {
    const totalBalance = info.balancePooled + info.balanceLocked;
    // Convert from wei to ether and assume 1:1 with USD for DAI
    return parseFloat(formatEther(totalBalance));
  };

  // Check for a specific MeToken by address (useful for newly created MeTokens)
  const checkSpecificMeToken = async (meTokenAddress: string) => {
    if (!address || !client) return null;

    try {
      // Get MeToken info from Diamond contract
      const info = await client.readContract({
        address: DIAMOND,
        abi: DIAMOND_ABI,
        functionName: 'getMeTokenInfo',
        args: [meTokenAddress as `0x${string}`],
      }) as any;

      // Check if this MeToken belongs to the current user
      if (info && info.owner.toLowerCase() === address.toLowerCase()) {
        // Get ERC20 token info
        const name = await client.readContract({
          address: meTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'name',
        }) as string;

        const symbol = await client.readContract({
          address: meTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }) as string;

        const totalSupply = await client.readContract({
          address: meTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'totalSupply',
        }) as bigint;

        const balance = await client.readContract({
          address: meTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }) as bigint;

        const meTokenData: MeTokenData = {
          address: meTokenAddress,
          name,
          symbol,
          totalSupply,
          balance,
          info: {
            owner: info.owner,
            hubId: info.hubId,
            balancePooled: info.balancePooled,
            balanceLocked: info.balanceLocked,
            startTime: info.startTime,
            endTime: info.endTime,
            endCooldown: info.endCooldown || BigInt(0),
            targetHubId: info.targetHubId,
            migration: info.migration,
          },
          tvl: calculateTVL({
            owner: info.owner,
            hubId: info.hubId,
            balancePooled: info.balancePooled,
            balanceLocked: info.balanceLocked,
            startTime: info.startTime,
            endTime: info.endTime,
            endCooldown: info.endCooldown || BigInt(0),
            targetHubId: info.targetHubId,
            migration: info.migration,
          }),
        };

        setUserMeToken(meTokenData);
        return meTokenData;
      }

      return null;
    } catch (err) {
      logger.error(`Failed to check MeToken ${meTokenAddress}:`, err);
      return null;
    }
  };

  // Buy MeTokens
  const buyMeTokens = async (meTokenAddress: string, collateralAmount: string) => {
    if (!address || !user) throw new Error('No wallet connected');

    try {
      await sendUserOperationAsync({
        uo: {
          target: DIAMOND,
          data: appendBuilderCode(encodeFunctionData({
            abi: DIAMOND_ABI,
            functionName: 'mint',
            args: [meTokenAddress as `0x${string}`, parseEther(collateralAmount), address as `0x${string}`],
          })),
          value: BigInt(0),
        },
      });
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to buy MeTokens');
    }
  };

  // Sell MeTokens
  const sellMeTokens = async (meTokenAddress: string, meTokenAmount: string) => {
    if (!address || !user) throw new Error('No wallet connected');

    try {
      await sendUserOperationAsync({
        uo: {
          target: DIAMOND,
          data: appendBuilderCode(encodeFunctionData({
            abi: DIAMOND_ABI,
            functionName: 'burn',
            args: [meTokenAddress as `0x${string}`, parseEther(meTokenAmount), address as `0x${string}`],
          })),
          value: BigInt(0),
        },
      });
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to sell MeTokens');
    }
  };

  // Calculate MeTokens to be minted
  const calculateMeTokensMinted = async (meTokenAddress: string, collateralAmount: string): Promise<string> => {
    try {
      if (!client) return '0';

      const result = await client.readContract({
        address: DIAMOND,
        abi: DIAMOND_ABI,
        functionName: 'calculateMeTokensMinted',
        args: [meTokenAddress as `0x${string}`, parseEther(collateralAmount)],
      });

      return formatEther(result as bigint);
    } catch (err) {
      logger.error('Failed to calculate MeTokens minted:', err);
      return '0';
    }
  };

  // Calculate assets returned
  const calculateAssetsReturned = async (meTokenAddress: string, meTokenAmount: string): Promise<string> => {
    try {
      if (!client || !address) return '0';

      const result = await client.readContract({
        address: DIAMOND,
        abi: DIAMOND_ABI,
        functionName: 'calculateAssetsReturned',
        args: [meTokenAddress as `0x${string}`, parseEther(meTokenAmount), address as `0x${string}`],
      });

      return formatEther(result as bigint);
    } catch (err) {
      logger.error('Failed to calculate assets returned:', err);
      return '0';
    }
  };

  useEffect(() => {
    if (address) {
      checkUserMeToken();
    }
  }, [address, checkUserMeToken]);

  return {
    userMeToken,
    loading,
    error: meTokenError,
    createMeToken,
    buyMeTokens,
    sellMeTokens,
    calculateMeTokensMinted,
    calculateAssetsReturned,
    getMeTokenInfo,
    calculateTVL,
    checkSpecificMeToken,
    isPending: isSendingUserOperation,
    isConfirming,
    isConfirmed,
    transactionError: error,
  };
}
