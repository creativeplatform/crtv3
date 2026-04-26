import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useSmartAccountClient } from '@account-kit/react';
import { parseEther, formatEther, encodeFunctionData } from 'viem';
import { meTokenSupabaseService, MeToken, MeTokenBalance } from '@/lib/sdk/supabase/metokens';
import { CreateMeTokenData, UpdateMeTokenData } from '@/lib/sdk/supabase/client';
import { getMeTokenFactoryContract, METOKEN_FACTORY_ADDRESSES } from '@/lib/contracts/MeTokenFactory';
import { METOKEN_ABI } from '@/lib/contracts/MeToken';
import { DAI_TOKEN_ADDRESSES, getDaiTokenContract } from '@/lib/contracts/DAIToken';
import { useToast } from '@/components/ui/use-toast';
import { useGasSponsorship } from '@/lib/hooks/wallet/useGasSponsorship';
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";

// MeTokens contract addresses on Base
const METOKEN_FACTORY = '0xb31Ae2583d983faa7D8C8304e6A16E414e721A0B';
const DIAMOND = '0xba5502db2aC2cBff189965e991C07109B14eB3f5';


// ERC20 ABI for MeToken
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "name",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
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
  hubId: number;
  balancePooled: bigint;
  balanceLocked: bigint;
  owner: string;
  created_at: string;
  updated_at: string;
}

export function useMeTokensSupabase(targetAddress?: string) {
  const user = useUser();
  const { client } = useSmartAccountClient({});
  const { toast } = useToast();
  const { getGasContext, isMember } = useGasSponsorship();

  // Use targetAddress if provided, otherwise use the smart account address from client
  const address = targetAddress || client?.account?.address || user?.address;

  const [userMeToken, setUserMeToken] = useState<MeTokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [meTokenError, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [transactionError, setTransactionError] = useState<Error | null>(null);

  // Convert Supabase MeToken to our MeTokenData format
  const convertToMeTokenData = useCallback(async (supabaseMeToken: MeToken, userAddress: string): Promise<MeTokenData> => {
    // Get user's balance from contract
    let userBalance = BigInt(0);
    try {
      if (client) {
        logger.debug('🔍 Fetching user balance for MeToken:', supabaseMeToken.address);
        userBalance = await client.readContract({
          address: supabaseMeToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress as `0x${string}`],
        }) as bigint;
        logger.debug('✅ User balance fetched:', userBalance.toString());
      } else {
        logger.warn('⚠️ No client available for balance check');
      }
    } catch (err) {
      logger.warn('⚠️ Failed to fetch user balance from contract (this is OK, will use 0):', err);
      // Set balance to 0 if we can't fetch it - this is fine for display purposes
      userBalance = BigInt(0);
    }

    // Get fresh data from contract
    let currentTotalSupply = BigInt(supabaseMeToken?.total_supply || 0);
    let currentInfo = {
      owner: supabaseMeToken?.owner_address || userAddress,
      hubId: BigInt(supabaseMeToken?.hub_id || 0),
      balancePooled: BigInt(supabaseMeToken?.balance_pooled || 0),
      balanceLocked: BigInt(supabaseMeToken?.balance_locked || 0),
      startTime: BigInt(0),
      endTime: BigInt(0),
      endCooldown: BigInt(0),
      targetHubId: BigInt(0),
      migration: "0x0000000000000000000000000000000000000000",
    };

    try {
      if (client && supabaseMeToken?.address) {
        logger.debug('🔍 Fetching fresh contract data for MeToken:', supabaseMeToken.address);

        // Fetch total supply
        const supplyData = await client.readContract({
          address: supabaseMeToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'totalSupply',
        }) as bigint;
        currentTotalSupply = supplyData;

        // Fetch MeToken Info from Diamond
        const infoData = await client.readContract({
          address: DIAMOND,
          abi: METOKEN_ABI,
          functionName: 'getMeTokenInfo',
          args: [supabaseMeToken.address as `0x${string}`],
        }) as any;

        if (infoData) {
          currentInfo = {
            owner: infoData.owner,
            hubId: BigInt(infoData.hubId || 0),
            balancePooled: BigInt(infoData.balancePooled || 0),
            balanceLocked: BigInt(infoData.balanceLocked || 0),
            startTime: BigInt(infoData.startTime || 0),
            endTime: BigInt(infoData.endTime || 0),
            endCooldown: BigInt(infoData.endCooldown || 0),
            targetHubId: BigInt(infoData.targetHubId || 0),
            migration: infoData.migration || "0x0000000000000000000000000000000000000000",
          };
        }
      }
    } catch (err) {
      logger.warn('⚠️ Failed to fetch fresh contract data, using Supabase fallback:', err);
    }

    // Calculate TVL (simplified: pooled DAI + locked DAI)
    // Note: Only DAI is considered for value here. 
    const calculatedTvl = parseFloat(formatEther(currentInfo.balancePooled + currentInfo.balanceLocked));

    return {
      address: supabaseMeToken.address,
      name: supabaseMeToken.name,
      symbol: supabaseMeToken.symbol,
      totalSupply: currentTotalSupply,
      balance: userBalance,
      info: currentInfo,
      tvl: calculatedTvl > 0 ? calculatedTvl : supabaseMeToken.tvl,
      hubId: Number(currentInfo.hubId),
      balancePooled: currentInfo.balancePooled,
      balanceLocked: currentInfo.balanceLocked,
      owner: currentInfo.owner,
      created_at: supabaseMeToken.created_at,
      updated_at: supabaseMeToken.updated_at,
    };
  }, [client]);


  // Check if user has a MeToken using Subgraph first, then API logic
  const checkUserMeToken = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      let foundInSubgraph = false;

      // 1. Try fetching from Subgraph (fastest & decentralized)
      try {
        const { meTokensSubgraph } = await import('@/lib/sdk/metokens/subgraph');
        const subgraphTokens = await meTokensSubgraph.getMeTokensByOwner(address);

        if (subgraphTokens.length > 0) {
          logger.debug('✅ Found MeToken in Subgraph:', subgraphTokens[0]);
          const latestToken = subgraphTokens[0];

          if (client) {
            // We need to fetch name/symbol/totalSupply from contract since subgraph might just have ID
            const contractAddress = latestToken.id as `0x${string}`;

            const [name, symbol, totalSupply] = await Promise.all([
              client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'name' }),
              client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'symbol' }),
              client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'totalSupply' })
            ]) as [string, string, bigint];

            // Get fresh info from Diamond for pooled/locked
            let currentInfo = {
              owner: latestToken.owner || address,
              hubId: BigInt(latestToken.hubId || 1),
              balancePooled: BigInt(latestToken.balancePooled || 0),
              balanceLocked: BigInt(latestToken.balanceLocked || 0),
              startTime: BigInt(latestToken.startTime || 0),
              endTime: BigInt(latestToken.endTime || 0),
              endCooldown: BigInt(latestToken.endCooldown || 0),
              targetHubId: BigInt(latestToken.targetHubId || 0),
              migration: latestToken.migration || "0x0000000000000000000000000000000000000000",
            };

            // Try to refresh info from contract if possible
            try {
              const infoData = await client.readContract({
                address: DIAMOND,
                abi: METOKEN_ABI,
                functionName: 'getMeTokenInfo',
                args: [contractAddress],
              }) as any;
              if (infoData) {
                currentInfo = {
                  owner: infoData.owner,
                  hubId: BigInt(infoData.hubId),
                  balancePooled: BigInt(infoData.balancePooled),
                  balanceLocked: BigInt(infoData.balanceLocked),
                  startTime: BigInt(infoData.startTime),
                  endTime: BigInt(infoData.endTime),
                  endCooldown: BigInt(infoData.endCooldown),
                  targetHubId: BigInt(infoData.targetHubId),
                  migration: infoData.migration,
                };
              }
            } catch (e) {
              logger.warn('⚠️ Failed to refresh info from contract, using subgraph data', e);
            }

            // Calculate TVL
            const calculatedTvl = parseFloat(formatEther(currentInfo.balancePooled + currentInfo.balanceLocked));

            // Get user balance
            let userBalance = BigInt(0);
            try {
              userBalance = await client.readContract({
                address: contractAddress,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [address as `0x${string}`],
              }) as bigint;
            } catch (e) { }

            const meTokenData: MeTokenData = {
              address: latestToken.id,
              name,
              symbol,
              totalSupply,
              balance: userBalance,
              info: currentInfo,
              tvl: calculatedTvl,
              hubId: Number(currentInfo.hubId),
              balancePooled: currentInfo.balancePooled,
              balanceLocked: currentInfo.balanceLocked,
              owner: currentInfo.owner,
              created_at: new Date(Number(currentInfo.startTime) * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            };

            setUserMeToken(meTokenData);
            foundInSubgraph = true;
          }
        }
      } catch (subgraphErr) {
        logger.warn('⚠️ Subgraph check failed, falling back to API:', subgraphErr);
      }

      if (foundInSubgraph) {
        setLoading(false);
        return;
      }

      // 2. Fallback to API/Supabase if not found in subgraph
      logger.debug('🔄 Checking Supabase API...');
      // Try primary address first
      let response = await fetch(`/api/metokens?owner=${address}`);
      let result = await response.json();
      let supabaseMeToken = result.data;

      // If not found, try the smart account address (if we have a client)
      if (!supabaseMeToken && client?.account?.address && client.account.address !== address) {
        logger.debug('🔍 Checking smart account address for MeToken:', client.account.address);
        response = await fetch(`/api/metokens?owner=${client.account.address}`);
        result = await response.json();
        supabaseMeToken = result.data;
      }

      // If still not found and we have a user with different EOA, try that too
      if (!supabaseMeToken && user?.address && user.address !== address) {
        logger.debug('🔍 Checking EOA address for MeToken:', user.address);
        response = await fetch(`/api/metokens?owner=${user.address}`);
        result = await response.json();
        supabaseMeToken = result.data;
      }

      if (supabaseMeToken) {
        logger.debug('✅ Found MeToken via API:', supabaseMeToken);
        const meTokenData = await convertToMeTokenData(supabaseMeToken, address);
        setUserMeToken(meTokenData);
      } else {
        logger.debug('❌ No MeToken found for any address');
        setUserMeToken(null);
      }
    } catch (err) {
      logger.error('❌ Error checking MeToken:', err);

      // Handle specific error cases
      if (err instanceof Error) {
        if (err.message.includes('MeToken not found') || err.message.includes('404')) {
          // This is expected when no MeToken exists for the user
          logger.debug('ℹ️ No MeToken found for user - this is normal');
          setUserMeToken(null);
          setError(null); // Don't show error for missing MeToken
        } else {
          setError(err.message);
          setUserMeToken(null);
        }
      } else {
        setError('Failed to check MeToken');
        setUserMeToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [address, user, client, convertToMeTokenData]);

  // Internal function to create MeToken (used for retries)
  const createMeTokenInternal = async (name: string, symbol: string, hubId: number = 1, assetsDeposited: string = "0", isRetry: boolean = false) => {
    logger.debug('🔧 createMeToken called', { name, symbol, hubId, assetsDeposited, address, user });

    if (!address) {
      const errorMsg = 'No wallet address available';
      logger.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    if (!user) {
      const errorMsg = 'No user connected - please ensure your smart account is properly initialized';
      logger.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    if (!client) {
      const errorMsg = 'Smart account client not initialized';
      logger.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    // First, check if user already has a MeToken to prevent the "already owns" error
    logger.debug('🔍 Checking if user already has a MeToken...');
    try {
      // Check database first
      await checkUserMeToken();
      if (userMeToken) {
        logger.debug('⚠️ User already has a MeToken in database:', userMeToken.address);
        throw new Error('You already have a MeToken. Please use the existing one or contact support if you need to create a new one.');
      }

      // Also check subgraph for any MeTokens that might not be in database yet
      logger.debug('🔍 Checking subgraph for existing MeTokens...');
      const { meTokensSubgraph } = await import('@/lib/sdk/metokens/subgraph');
      const allMeTokens = await meTokensSubgraph.getAllMeTokens(50, 0);
      logger.debug(`📋 Found ${allMeTokens.length} recent MeTokens in subgraph`);

      // Check if any of these MeTokens belong to our user
      // Check if any of these MeTokens belong to our user
      const recentTokens = allMeTokens.slice(0, 10);
      if (recentTokens.length > 0) {
        try {
          const { getBulkMeTokenInfo } = await import('@/lib/utils/metokenUtils');
          const recentTokenIds = recentTokens.map(t => t.id);
          logger.debug('📦 Bulk checking ownership for:', recentTokenIds);
          const results = await getBulkMeTokenInfo(recentTokenIds);

          for (const id of recentTokenIds) {
            const info = results[id];
            if (info && info.owner.toLowerCase() === address.toLowerCase()) {
              logger.debug('⚠️ User already has a MeToken in subgraph (via bulk check):', id);
              throw new Error('You already have a MeToken. Please use the existing one or contact support if you need to create a new one.');
            }
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes('already have a MeToken')) {
            throw err;
          }
          logger.warn('Failed to check MeToken ownership via bulk info:', err);
        }
      }

      // Additional check: Query the Diamond contract directly to see if user already owns a meToken
      logger.debug('🔍 Checking Diamond contract for existing MeToken ownership...');
      try {
        const { getLatestMeTokenByOwner } = await import('@/lib/utils/metokenUtils');

        // Check multiple addresses that could be the meToken owner
        const addressesToCheck = [address];
        if (client?.account?.address && client.account.address !== address) {
          addressesToCheck.push(client.account.address);
        }
        if (user?.address && user.address !== address) {
          addressesToCheck.push(user.address);
        }

        logger.debug('🔍 Checking addresses for existing MeTokens:', addressesToCheck);

        for (const checkAddress of addressesToCheck) {
          const existingMeTokenAddress = await getLatestMeTokenByOwner(checkAddress);
          if (existingMeTokenAddress) {
            logger.debug('⚠️ User already has a MeToken according to Diamond contract:', existingMeTokenAddress, 'for address:', checkAddress);
            throw new Error('You already have a MeToken. Please use the "Sync Existing MeToken" button to load it.');
          }
        }
      } catch (diamondErr) {
        // This is expected if the user doesn't have a meToken, so we continue
        logger.debug('✅ No existing MeToken found in Diamond contract (this is expected for new users)');
      }

      logger.debug('✅ No existing MeToken found, proceeding with creation...');
    } catch (checkErr) {
      if (checkErr instanceof Error && checkErr.message.includes('already have a MeToken')) {
        throw checkErr; // Re-throw the "already have" error
      }
      logger.debug('ℹ️ No existing MeToken found, proceeding with creation...');
    }

    // Debug: Log address information
    logger.debug('🔍 Address debugging:', {
      smartAccountAddress: address,
      userEOAAddress: user.address,
      clientAccountAddress: client.account?.address,
      addressesMatch: address === user.address
    });

    // Check if smart account is deployed
    try {
      const code = await client.getCode({ address: address as `0x${string}` });
      logger.debug('🏗️ Smart account deployment status:', {
        address: address,
        hasCode: code !== '0x',
        codeLength: code ? code.length : 0
      });

      if (code === '0x') {
        logger.warn('⚠️ Smart account appears to be undeployed. This might cause issues with token interactions.');
      }
    } catch (deployErr) {
      logger.warn('⚠️ Could not check smart account deployment status:', deployErr);
    }

    setIsPending(true);
    setIsConfirming(false);
    setIsConfirmed(false);
    setError(null);
    setTransactionError(null);

    try {
      // COMBINED STEP: Create AND Subscribe in one transaction
      // This is more efficient and ensures the MeToken is registered with the protocol
      logger.debug('📦 Creating and subscribing MeToken...');

      const depositAmount = parseEther(assetsDeposited);

      // If depositing DAI, we need to approve the vault contract (not Diamond!)
      // The subscribe function calls IVault(vault).handleDeposit() which calls transferFrom
      if (depositAmount > BigInt(0)) {
        logger.debug('💰 Depositing DAI, checking approval...');

        // DAI contract address on Base
        const DAI_ADDRESS = DAI_TOKEN_ADDRESSES.base;
        const daiContract = getDaiTokenContract('base');

        // First, check if user has sufficient DAI balance
        logger.debug('💳 Checking DAI balance...');
        logger.debug('🔍 DAI balance check details:', {
          daiContractAddress: DAI_ADDRESS,
          smartAccountAddress: address,
          userEOAAddress: user?.address,
          clientAccountAddress: client.account?.address
        });

        let daiBalance: bigint;
        try {
          daiBalance = await client.readContract({
            address: daiContract.address as `0x${string}`,
            abi: daiContract.abi,
            functionName: 'balanceOf',
            args: [address as `0x${string}`]
          }) as bigint;

          logger.debug('✅ DAI balance check successful');
        } catch (balanceErr) {
          logger.error('❌ DAI balance check failed:', balanceErr);
          throw new Error(`Failed to check DAI balance: ${balanceErr instanceof Error ? balanceErr.message : 'Unknown error'}`);
        }

        logger.debug('📊 DAI balance result:', {
          balanceWei: daiBalance.toString(),
          balanceDAI: formatEther(daiBalance),
          requiredWei: depositAmount.toString(),
          requiredDAI: formatEther(depositAmount),
          hasEnough: daiBalance >= depositAmount
        });

        if (daiBalance < depositAmount) {
          // If smart account has no DAI, check if EOA has DAI (in case of address confusion)
          if (user?.address && user.address !== address) {
            logger.debug('🔍 Smart account has no DAI, checking EOA balance...');
            try {
              const eoaBalance = await client.readContract({
                address: daiContract.address as `0x${string}`,
                abi: daiContract.abi,
                functionName: 'balanceOf',
                args: [user.address as `0x${string}`]
              }) as bigint;

              logger.debug('📊 EOA DAI balance:', {
                balanceWei: eoaBalance.toString(),
                balanceDAI: formatEther(eoaBalance),
                eoaAddress: user.address
              });

              if (eoaBalance >= depositAmount) {
                throw new Error(
                  `DAI is in your EOA wallet (${user.address}) but the transaction is being sent from your smart account (${address}). ` +
                  'Please transfer DAI to your smart account first.'
                );
              }
            } catch (eoaErr) {
              logger.warn('⚠️ Failed to check EOA balance:', eoaErr);
            }
          }

          throw new Error(
            `Insufficient DAI balance in smart account (${address}). You have ${formatEther(daiBalance)} DAI ` +
            `but need ${formatEther(depositAmount)} DAI. Please ensure your DAI is in your smart account wallet.`
          );
        }

        // Get the vault address for this hub (the actual spender for subscribe)
        logger.debug('🔍 Fetching Vault address for Hub ID:', hubId);
        let vaultAddress: string | null = null;
        try {
          const hubInfo = await client.readContract({
            address: DIAMOND,
            abi: METOKEN_ABI,
            functionName: 'getHubInfo',
            args: [BigInt(hubId)],
          }) as any;

          // Extract vault address (index 6 in the tuple)
          if (Array.isArray(hubInfo)) {
            vaultAddress = hubInfo[6] as string;
          } else if (typeof hubInfo === 'object' && 'vault' in hubInfo) {
            vaultAddress = hubInfo.vault as string;
          } else {
            vaultAddress = (hubInfo as any)[6] || (hubInfo as any).vault;
          }

          // Validate vault address - if zero or invalid, skip vault approval (DIAMOND approval will handle it)
          if (!vaultAddress || vaultAddress === '0x0000000000000000000000000000000000000000') {
            logger.warn('⚠️ Vault address is zero or invalid, skipping vault approval (will rely on DIAMOND approval)');
            vaultAddress = null;
          } else {
            logger.debug('✅ Vault address for Hub ID', hubId, ':', vaultAddress);
          }
        } catch (vaultErr) {
          logger.error('❌ Failed to get vault address, skipping vault approval (will rely on DIAMOND approval):', vaultErr);
          vaultAddress = null;
        }

        // Only check/approve vault if we successfully retrieved a valid vault address
        // If vault address retrieval failed, skip this block and rely on DIAMOND approval only
        if (vaultAddress) {
          // Check current allowance for vault (the actual spender)
          logger.debug('🔍 Checking DAI allowance for vault...');
          const currentAllowance = await client.readContract({
            address: daiContract.address as `0x${string}`,
            abi: daiContract.abi,
            functionName: 'allowance',
            args: [address as `0x${string}`, vaultAddress as `0x${string}`]
          }) as bigint;

          logger.debug('📊 Current DAI allowance for vault:', {
            vaultAddress,
            currentAllowance: currentAllowance.toString(),
            required: depositAmount.toString(),
            hasEnough: currentAllowance >= depositAmount
          });

          if (currentAllowance < depositAmount) {
            logger.debug('🔓 Approving DAI for vault...', vaultAddress);

            const approveData = encodeFunctionData({
              abi: daiContract.abi,
              functionName: 'approve',
              args: [vaultAddress as `0x${string}`, depositAmount],
            });

            logger.debug('📤 Sending DAI approval user operation...');
            logger.debug('📊 Approval details:', {
              target: DAI_ADDRESS,
              spender: vaultAddress,
              hubId,
              amount: depositAmount.toString(),
              smartAccountAddress: address,
              approvalData: approveData
            });

            // Apply gas sponsorship for approval too
            const approveGasContext = getGasContext('usdc');
            const approvePrimaryContext = approveGasContext.context;

            let approveOp;
            try {
              approveOp = await client.sendUserOperation({
                uo: {
                  target: daiContract.address as `0x${string}`,
                  data: appendBuilderCode(approveData),
                  value: BigInt(0),
                },
                context: approvePrimaryContext, // Apply gas sponsorship
              });
            } catch (approveGasError) {
              if (approvePrimaryContext) {
                logger.warn("⚠️ DAI approval primary gas payment failed, falling back to standard gas:", approveGasError);
                logger.debug('🔄 Attempting fallback with standard ETH gas for approval...');
                const fallbackApprovePromise = client.sendUserOperation({
                  uo: {
                    target: daiContract.address as `0x${string}`,
                    data: appendBuilderCode(approveData),
                    value: BigInt(0),
                  },
                  // No context = standard ETH payment
                  overrides: {
                    paymasterAndData: undefined,
                  },
                });

                // Add timeout to prevent indefinite hanging (60 seconds)
                const fallbackTimeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Vault approval fallback timed out after 60 seconds')), 60000);
                });

                approveOp = await Promise.race([fallbackApprovePromise, fallbackTimeoutPromise]) as any;
              } else {
                throw approveGasError;
              }
            }

            logger.debug('🎉 Approval UserOperation sent! Hash:', approveOp.hash);
            logger.debug('⏳ Waiting for approval confirmation...');

            const approvalTxHash = await client.waitForUserOperationTransaction({
              hash: approveOp.hash,
            });

            logger.debug('✅ Approval transaction confirmed! Hash:', approvalTxHash);

            logger.debug('✅ DAI approved!');

            // Wait for the approval state to propagate with retry logic
            logger.debug('⏳ Waiting for approval state to update...');
            let newAllowance = BigInt(0);
            let retryCount = 0;
            const maxRetries = 5;

            while (retryCount < maxRetries && newAllowance < depositAmount) {
              // Wait progressively longer between retries
              const waitTime = 2000 + (retryCount * 1000); // 2s, 3s, 4s, 5s, 6s
              logger.debug(`⏳ Waiting ${waitTime}ms for approval state to update... (attempt ${retryCount + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, waitTime));

              try {
                // Verify the approval was successful
                newAllowance = await client.readContract({
                  address: daiContract.address as `0x${string}`,
                  abi: daiContract.abi,
                  functionName: 'allowance',
                  args: [address as `0x${string}`, vaultAddress as `0x${string}`]
                }) as bigint;

                logger.debug(`📊 DAI allowance check ${retryCount + 1}: ${newAllowance.toString()} (expected: ${depositAmount.toString()})`);

                if (newAllowance >= depositAmount) {
                  logger.debug('✅ DAI allowance confirmed!');
                  break;
                }
              } catch (err) {
                logger.warn(`⚠️ Allowance check failed on attempt ${retryCount + 1}:`, err);
              }

              retryCount++;
            }

            if (newAllowance < depositAmount) {
              logger.error('❌ DAI approval verification failed after all retries');
              logger.error('📊 Final allowance:', newAllowance.toString());
              logger.error('📊 Expected allowance:', depositAmount.toString());
              logger.error('📊 Smart account address:', address);
              logger.error('📊 Vault address:', vaultAddress);
              logger.error('📊 Hub ID:', hubId);

              // Provide helpful error message with suggestions
              const errorMsg = `DAI approval failed after ${maxRetries} retries. This could be due to:
1. Network congestion - try again in a few minutes
2. Smart account deployment issue - ensure your account is properly deployed
3. Insufficient gas - the approval transaction may have failed
4. RPC provider issues - try refreshing the page

Expected allowance: ${formatEther(depositAmount)} DAI
Actual allowance: ${formatEther(newAllowance)} DAI

You can try creating your MeToken with 0 DAI deposit and add liquidity later.`;

              throw new Error(errorMsg);
            }
          } else {
            logger.debug('✅ Sufficient DAI allowance already exists for vault');
          }
        } // End of vault approval block (only executed if vaultAddress is valid)

        // 3b. ALSO Check/Approve DAI for the DIAMOND (Just in case Diamond calls transferFrom directly)
        // This covers the case where Diamond is the spender, or Vault is the spender.
        logger.debug('🔍 Checking DAI allowance for DIAMOND (fallback)...');
        const diamondAllowance = await client.readContract({
          address: daiContract.address as `0x${string}`,
          abi: daiContract.abi,
          functionName: 'allowance',
          args: [address as `0x${string}`, DIAMOND as `0x${string}`]
        }) as bigint;

        logger.debug('📊 Current DAI allowance for DIAMOND:', diamondAllowance.toString());

        if (diamondAllowance < depositAmount) {
          logger.debug('🔓 Approving DAI for DIAMOND (fallback)...');
          const diamondApproveData = encodeFunctionData({
            abi: daiContract.abi,
            functionName: 'approve',
            args: [DIAMOND as `0x${string}`, depositAmount],
          });

          logger.debug('📤 Sending DAI approval for DIAMOND user operation...');

          // Apply gas sponsorship for DIAMOND approval (consistent with vault approval)
          const diamondApproveGasContext = getGasContext('usdc');
          const diamondApprovePrimaryContext = diamondApproveGasContext.context;

          let diamondApproveOp;
          try {
            diamondApproveOp = await client.sendUserOperation({
              uo: {
                target: daiContract.address as `0x${string}`,
                data: appendBuilderCode(diamondApproveData),
                value: BigInt(0),
              },
              context: diamondApprovePrimaryContext, // Apply gas sponsorship
            });
          } catch (diamondApproveGasError) {
            if (diamondApprovePrimaryContext) {
              logger.warn("⚠️ DAI approval for DIAMOND primary gas payment failed, falling back to standard gas:", diamondApproveGasError);
              logger.debug('🔄 Attempting fallback with standard ETH gas for DIAMOND approval...');
              const fallbackDiamondApprovePromise = client.sendUserOperation({
                uo: {
                  target: daiContract.address as `0x${string}`,
                  data: appendBuilderCode(diamondApproveData),
                  value: BigInt(0),
                },
                // No context = standard ETH payment
                overrides: {
                  paymasterAndData: undefined,
                },
              });

              // Add timeout to prevent indefinite hanging (60 seconds)
              const fallbackDiamondTimeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('DIAMOND approval fallback timed out after 60 seconds')), 60000);
              });

              diamondApproveOp = await Promise.race([fallbackDiamondApprovePromise, fallbackDiamondTimeoutPromise]) as any;
            } else {
              throw diamondApproveGasError;
            }
          }

          logger.debug('⏳ Waiting for DIAMOND approval confirmation...', diamondApproveOp.hash);
          const diamondApprovalTxHash = await client.waitForUserOperationTransaction({
            hash: diamondApproveOp.hash,
          });

          logger.debug('✅ DIAMOND approval transaction confirmed! Hash:', diamondApprovalTxHash);

          // Wait for the approval state to propagate with retry logic
          logger.debug('⏳ Waiting for DIAMOND approval state to update...');
          let diamondNewAllowance = BigInt(0);
          let diamondRetryCount = 0;
          const diamondMaxRetries = 5;

          while (diamondRetryCount < diamondMaxRetries && diamondNewAllowance < depositAmount) {
            // Wait progressively longer between retries
            const waitTime = 2000 + (diamondRetryCount * 1000); // 2s, 3s, 4s, 5s, 6s
            logger.debug(`⏳ Waiting ${waitTime}ms for DIAMOND approval state to update... (attempt ${diamondRetryCount + 1}/${diamondMaxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));

            try {
              // Verify the approval was successful
              diamondNewAllowance = await client.readContract({
                address: daiContract.address as `0x${string}`,
                abi: daiContract.abi,
                functionName: 'allowance',
                args: [address as `0x${string}`, DIAMOND as `0x${string}`]
              }) as bigint;

              logger.debug(`📊 DAI allowance for DIAMOND check ${diamondRetryCount + 1}: ${diamondNewAllowance.toString()} (expected: ${depositAmount.toString()})`);

              if (diamondNewAllowance >= depositAmount) {
                logger.debug('✅ DAI allowance for DIAMOND confirmed!');
                break;
              }
            } catch (err) {
              logger.warn(`⚠️ DIAMOND allowance check failed on attempt ${diamondRetryCount + 1}:`, err);
            }

            diamondRetryCount++;
          }

          if (diamondNewAllowance < depositAmount) {
            logger.error('❌ DAI approval for DIAMOND verification failed after all retries');
            logger.error('📊 Final allowance:', diamondNewAllowance.toString());
            logger.error('📊 Expected allowance:', depositAmount.toString());
            logger.error('📊 Smart account address:', address);
            logger.error('📊 DIAMOND address:', DIAMOND);

            // Provide helpful error message with suggestions
            const errorMsg = `DAI approval for DIAMOND failed after ${diamondMaxRetries} retries. This could be due to:
1. Network congestion - try again in a few minutes
2. Smart account deployment issue - ensure your account is properly deployed
3. Insufficient gas - the approval transaction may have failed
4. RPC provider issues - try refreshing the page

Expected allowance: ${formatEther(depositAmount)} DAI
Actual allowance: ${formatEther(diamondNewAllowance)} DAI

You can try creating your MeToken with 0 DAI deposit and add liquidity later.`;

            throw new Error(errorMsg);
          }

          logger.debug('✅ DAI approved for DIAMOND');
        } else {
          logger.debug('✅ Sufficient DAI allowance already exists for DIAMOND');
        }
      }

      const SUBSCRIBE_ABI = [{
        "inputs": [
          { "internalType": "string", "name": "name", "type": "string" },
          { "internalType": "string", "name": "symbol", "type": "string" },
          { "internalType": "uint256", "name": "hubId", "type": "uint256" },
          { "internalType": "uint256", "name": "assetsDeposited", "type": "uint256" }
        ],
        "name": "subscribe",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }] as const;

      const subscribeData = encodeFunctionData({
        abi: SUBSCRIBE_ABI,
        functionName: 'subscribe',
        args: [name, symbol, BigInt(hubId), depositAmount],
      });

      logger.debug('🔨 Encoded subscribe data');

      // Apply gas sponsorship: Members get sponsored, Non-members pay in USDC or ETH
      const gasContext = getGasContext('usdc');
      const primaryContext = gasContext.context;

      logger.debug(`📤 Sending subscribe user operation via client with ${gasContext.isSponsored ? 'Sponsored' : (primaryContext ? 'USDC' : 'Standard ETH')} gas...`);
      logger.debug('🔍 Operation details:', {
        target: DIAMOND,
        hasData: !!subscribeData,
        dataLength: subscribeData?.length,
        hasContext: !!primaryContext,
        contextType: primaryContext ? (gasContext.isSponsored ? 'Sponsored' : 'USDC') : 'None'
      });

      let operation;
      try {
        logger.debug('⏳ Calling sendUserOperation (this may take a moment)...');
        const sendOpPromise = client.sendUserOperation({
          uo: {
            target: DIAMOND, // Subscribe is called on the Diamond contract
            data: appendBuilderCode(subscribeData),
            value: BigInt(0),
          },
          context: primaryContext, // Apply gas sponsorship context
        });

        // Add timeout to prevent indefinite hanging (60 seconds)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('sendUserOperation timed out after 60 seconds')), 60000);
        });

        logger.debug('⏳ Waiting for sendUserOperation to complete...');
        operation = await Promise.race([sendOpPromise, timeoutPromise]) as any;
        logger.debug('✅ sendUserOperation completed!');
      } catch (gasError) {
        // Detect timeout errors - DO NOT retry on timeout to avoid duplicate transactions
        // The original operation may still complete in the background
        const isTimeoutError = gasError instanceof Error && gasError.message.includes('timed out after 60 seconds');

        if (isTimeoutError) {
          logger.error('❌ sendUserOperation timed out after 60 seconds');
          logger.error('⚠️ The original operation may still be pending and could complete later.');
          logger.error('⚠️ NOT retrying to avoid creating duplicate MeToken subscriptions.');
          logger.error('💡 Please wait a few moments and check if the transaction completed, then retry if needed.');
          throw new Error('Transaction timed out. Please wait a few moments to check if it completed, then retry if necessary. This prevents duplicate transactions.');
        }

        logger.error('❌ Error sending user operation:', gasError);
        logger.error('❌ Error details:', {
          message: gasError instanceof Error ? gasError.message : String(gasError),
          stack: gasError instanceof Error ? gasError.stack : undefined,
          name: gasError instanceof Error ? gasError.name : undefined,
          hasPrimaryContext: !!primaryContext
        });

        // Only retry on actual operation errors (not timeouts)
        if (primaryContext) {
          logger.warn("⚠️ Primary gas payment failed, falling back to standard gas:", gasError);
          logger.debug('🔄 Attempting fallback with standard ETH gas...');
          try {
            const fallbackSubscribePromise = client.sendUserOperation({
              uo: {
                target: DIAMOND,
                data: appendBuilderCode(subscribeData),
                value: BigInt(0),
              },
              // No context = standard ETH payment
              overrides: {
                paymasterAndData: undefined,
              },
            });

            // Add timeout to prevent indefinite hanging (60 seconds)
            const fallbackSubscribeTimeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Subscribe fallback timed out after 60 seconds')), 60000);
            });

            operation = await Promise.race([fallbackSubscribePromise, fallbackSubscribeTimeoutPromise]) as any;
            logger.debug('✅ Fallback to standard gas succeeded!');
          } catch (fallbackError) {
            logger.error('❌ Fallback to standard gas also failed:', fallbackError);
            throw new Error(`Failed to send user operation with both primary (${gasContext.isSponsored ? 'Sponsored' : 'USDC'}) and fallback (ETH) gas methods. Last error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
          }
        } else {
          throw gasError;
        }
      }

      logger.debug('🎉 UserOperation sent! Hash:', operation.hash);
      setIsPending(false);
      setIsConfirming(true);

      logger.debug('⏳ Waiting for transaction confirmation...');

      let txHash: string;
      try {
        txHash = await client.waitForUserOperationTransaction({
          hash: operation.hash,
        });
      } catch (waitError) {
        throw waitError;
      }

      logger.debug('✅ Transaction mined! Hash:', txHash);

      // For UserOperations (EIP-4337), we need to use the subgraph to find the MeToken
      // The subgraph indexes Subscribe events which contain the MeToken address

      logger.debug('🔍 Querying subgraph for newly created MeToken...');

      let meTokenAddress: string | null = null;

      try {
        // Import the subgraph client
        const { meTokensSubgraph } = await import('@/lib/sdk/metokens/subgraph');

        // Wait for subgraph to index the event (usually takes a few seconds)
        logger.debug('⏳ Waiting 3s for subgraph indexing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get all recent MeTokens from subgraph
        logger.debug('📊 Fetching recent MeTokens from subgraph...');
        const allMeTokens = await meTokensSubgraph.getAllMeTokens(20, 0);
        logger.debug(`📋 Found ${allMeTokens.length} recent MeTokens from subgraph`);

        if (allMeTokens.length > 0) {
          logger.debug('Recent MeTokens:', allMeTokens.slice(0, 3).map(mt => mt.id));

          // The most recent one (first in the list) is most likely ours since we just created it
          // Skip ownership verification from Diamond as it may not be fully registered yet
          meTokenAddress = allMeTokens[0].id;
          logger.debug('✅ Using most recent MeToken from subgraph:', meTokenAddress);
        }

        if (meTokenAddress) {
          // Sync the MeToken to the database
          logger.debug('💾 Syncing MeToken to database...');
          const syncResponse = await fetch('/api/metokens/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meTokenAddress,
              transactionHash: txHash
            })
          });

          if (syncResponse.ok) {
            logger.debug('✅ MeToken synced to database successfully');
            setIsConfirming(false);
            setIsConfirmed(true);

            // Refresh the user's MeToken data
            await checkUserMeToken();
            return;
          } else {
            const error = await syncResponse.json();
            logger.warn('⚠️ Failed to sync MeToken:', error);
          }
        }
      } catch (error) {
        logger.error('❌ Error querying subgraph:', error);
      }

      // If we couldn't find/sync the MeToken, still show success and auto-refresh
      logger.debug('🎉 MeToken created successfully!');
      logger.debug('💡 Transaction hash:', txHash);
      logger.debug('🔄 Refreshing page in 5 seconds to pick up your MeToken...');

      setIsConfirming(false);
      setIsConfirmed(true);

      // Auto-refresh after a longer delay to allow subgraph indexing
      setTimeout(() => {
        window.location.reload();
      }, 5000);

      return;

    } catch (err) {
      logger.error('❌ Error in createMeToken:', err);

      setIsPending(false);
      setIsConfirming(false);

      // Handle specific error cases
      if (err instanceof Error) {
        logger.error('❌ Error message:', err.message);
        logger.error('❌ Error stack:', err.stack);

        // Check if it's a DAI approval error and offer fallback
        if (err.message.includes('DAI approval failed') && parseFloat(assetsDeposited) > 0) {
          logger.debug('💡 DAI approval failed, but user can still create MeToken with 0 DAI');

          toast({
            title: "DAI Approval Failed",
            description: "Creating MeToken without initial DAI deposit. You can add liquidity later.",
            duration: 5000,
          });

          // Retry with 0 DAI deposit
          try {
            logger.debug('🔄 Retrying MeToken creation with 0 DAI deposit...');
            await createMeTokenInternal(name, symbol, hubId, "0", true);
            return; // Exit successfully
          } catch (retryErr) {
            logger.error('❌ Retry with 0 DAI also failed:', retryErr);
            // Fall through to original error handling
          }
        }

        // Check if user already owns a MeToken
        // Check error message, details, and cause for "already owns" errors
        const errorMessage = err.message || '';
        const errorDetails = (err as any).details || '';
        const errorCause = (err as any).cause?.message || '';
        const hasAlreadyOwnsError =
          errorMessage.toLowerCase().includes('already owns a metoken') ||
          errorMessage.toLowerCase().includes('already owns') ||
          errorDetails.toLowerCase().includes('already owns a metoken') ||
          errorDetails.toLowerCase().includes('already owns') ||
          errorCause.toLowerCase().includes('already owns a metoken') ||
          errorCause.toLowerCase().includes('already owns');

        if (hasAlreadyOwnsError) {
          logger.debug('💡 User already owns a MeToken! Finding and syncing it...');
          logger.debug('📋 Error details:', { errorMessage, errorDetails, errorCause });

          try {
            let foundUserMeToken = false;
            let meTokenAddress: string | null = null;

            // Step 1: Check Supabase first (fastest)
            logger.debug('🔍 Step 1: Checking Supabase for existing MeToken...');
            const addressesToCheck = [address];
            if (client?.account?.address && client.account.address !== address) {
              addressesToCheck.push(client.account.address);
            }
            if (user?.address && user.address !== address) {
              addressesToCheck.push(user.address);
            }

            for (const checkAddress of addressesToCheck) {
              try {
                const response = await fetch(`/api/metokens?owner=${checkAddress}`);
                if (response.ok) {
                  const result = await response.json();
                  if (result.data) {
                    logger.debug('✅ Found MeToken in Supabase for address:', checkAddress);
                    meTokenAddress = result.data.address;
                    foundUserMeToken = true;
                    break;
                  }
                }
              } catch (apiErr) {
                logger.warn('Failed to check Supabase for address:', checkAddress, apiErr);
              }
            }

            // Step 2: If not in Supabase, query blockchain directly
            if (!foundUserMeToken) {
              logger.debug('🔍 Step 2: Querying blockchain directly for user MeToken...');
              const { getLatestMeTokenByOwner } = await import('@/lib/utils/metokenUtils');

              for (const checkAddress of addressesToCheck) {
                try {
                  const existingMeTokenAddress = await getLatestMeTokenByOwner(checkAddress);
                  if (existingMeTokenAddress) {
                    logger.debug('✅ Found MeToken on blockchain for address:', checkAddress, existingMeTokenAddress);
                    meTokenAddress = existingMeTokenAddress;
                    foundUserMeToken = true;
                    break;
                  }
                } catch (blockchainErr) {
                  logger.warn('Failed to query blockchain for address:', checkAddress, blockchainErr);
                }
              }
            }

            // Step 3: If we found the MeToken, sync it
            if (foundUserMeToken && meTokenAddress) {
              logger.debug('💾 Syncing found MeToken:', meTokenAddress);
              try {
                const syncResponse = await fetch('/api/metokens/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ meTokenAddress })
                });

                if (syncResponse.ok) {
                  const syncData = await syncResponse.json();
                  logger.debug('✅ Successfully synced MeToken:', syncData);

                  // Refresh to load the MeToken from database
                  logger.debug('🔄 Refreshing to display your MeToken...');
                  await checkUserMeToken();

                  setIsConfirmed(true);

                  toast({
                    title: "MeToken Found!",
                    description: "Your existing MeToken has been synced and is now displayed.",
                    duration: 3000,
                  });

                  setTimeout(() => {
                    window.location.reload();
                  }, 2000);

                  return;
                } else {
                  const errorData = await syncResponse.json().catch(() => ({}));
                  logger.warn('⚠️ Failed to sync MeToken:', errorData);
                }
              } catch (syncErr) {
                logger.error('❌ Error syncing MeToken:', syncErr);
              }
            }

            // Step 4: Fallback to subgraph search (if we still haven't found it)
            if (!foundUserMeToken) {
              logger.debug('🔍 Step 3: Falling back to subgraph search...');
              const { meTokensSubgraph } = await import('@/lib/sdk/metokens/subgraph');
              logger.debug('📊 Fetching recent MeTokens from subgraph...');
              const allMeTokens = await meTokensSubgraph.getAllMeTokens(100, 0);
              logger.debug(`📋 Found ${allMeTokens.length} recent MeTokens in subgraph`);

              if (allMeTokens.length > 0) {
                // Try to sync the most recent ones to database
                for (const meToken of allMeTokens.slice(0, 20)) {
                  try {
                    logger.debug('💾 Attempting to sync MeToken:', meToken.id);
                    const syncResponse = await fetch('/api/metokens/sync', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ meTokenAddress: meToken.id })
                    });

                    if (syncResponse.ok) {
                      const syncData = await syncResponse.json();
                      logger.debug('✅ Synced MeToken:', syncData);

                      // Check if this one belongs to our user
                      if (syncData.data?.owner_address?.toLowerCase() === address.toLowerCase()) {
                        logger.debug('🎯 Found our MeToken!');
                        foundUserMeToken = true;
                        break;
                      }
                    }
                  } catch (syncErr) {
                    logger.warn('Failed to sync MeToken:', meToken.id, syncErr);
                  }
                }
              }

              if (foundUserMeToken) {
                // Refresh to load the MeToken from database
                logger.debug('🔄 Refreshing to display your MeToken...');
                await checkUserMeToken();

                setIsConfirmed(true);

                toast({
                  title: "MeToken Found!",
                  description: "Your existing MeToken has been synced and is now displayed.",
                  duration: 3000,
                });

                setTimeout(() => {
                  window.location.reload();
                }, 2000);

                return;
              }
            }

            // If we still couldn't find the user's MeToken, provide helpful instructions
            logger.debug('⚠️ Could not find user MeToken after all attempts');
            throw new Error('You already have a MeToken, but we could not locate it automatically. ' +
              'Please use the "Sync Existing MeToken" button to load it manually, or contact support for assistance.');
          } catch (syncErr) {
            logger.error('❌ Failed to find existing MeToken:', syncErr);
            if (syncErr instanceof Error && syncErr.message.includes('already have a MeToken')) {
              throw syncErr; // Re-throw our custom error
            }
            throw new Error('You already have a MeToken, but we could not load it automatically. ' +
              'Please use the "Sync Existing MeToken" button to load it manually, or contact support for assistance.');
          }
        }

        setTransactionError(err);
        if (err.message.includes('User denied') || err.message.includes('User rejected')) {
          throw new Error('Transaction was rejected by user');
        }
        throw err;
      }
      logger.error('❌ Unknown error type:', typeof err);
      const error = new Error('Failed to create MeToken');
      setTransactionError(error);
      throw error;
    }
  };

  // Public wrapper function for createMeToken
  const createMeToken = async (name: string, symbol: string, hubId: number = 1, assetsDeposited: string = "0") => {
    return createMeTokenInternal(name, symbol, hubId, assetsDeposited, false);
  };

  // Buy MeTokens
  const buyMeTokens = async (
    meTokenAddress: string,
    collateralAmount: string,
    videoTracking?: { video_id?: number; playback_id?: string }
  ) => {
    if (!address || !user) throw new Error('No wallet connected');
    if (!client) throw new Error('Smart account client not initialized');

    setIsPending(true);
    setIsConfirming(false);
    setTransactionError(null);

    try {
      // Get gas sponsorship context (sponsored for members, USDC for non-members)
      const { context: gasContext, isSponsored } = getGasContext('usdc');
      logger.debug('🔧 Gas context for buyMeTokens:', {
        gasContext,
        isMember,
        isSponsored,
        hasPolicyId: !!gasContext?.paymasterService?.policyId,
        policyId: gasContext?.paymasterService?.policyId,
        tokenAddress: gasContext?.erc20?.tokenAddress,
      });

      // Get the vault address that will actually perform transferFrom
      // 1. Get meToken's hubId
      const meTokenInfo = await client.readContract({
        address: DIAMOND,
        abi: METOKEN_ABI,
        functionName: 'getMeTokenInfo',
        args: [meTokenAddress as `0x${string}`],
      }) as any;

      const hubId = meTokenInfo.hubId || meTokenInfo[1] || BigInt(1);

      // 2. Get vault address for this hub
      logger.debug('🔍 Fetching Vault address for Hub ID:', hubId.toString());
      const hubInfo = await client.readContract({
        address: DIAMOND,
        abi: METOKEN_ABI,
        functionName: 'getHubInfo',
        args: [hubId],
      }) as any;

      logger.debug('🔍 Raw Hub Info:', hubInfo);

      // Extract vault address (index 6 in the tuple)
      let vaultAddress: string;
      if (Array.isArray(hubInfo)) {
        vaultAddress = hubInfo[6] as string;
      } else if (typeof hubInfo === 'object' && 'vault' in hubInfo) {
        vaultAddress = hubInfo.vault as string;
      } else {
        vaultAddress = (hubInfo as any)[6] || (hubInfo as any).vault;
      }

      // Fallback to Diamond if vault is zero address (shouldn't happen, but safe)
      if (!vaultAddress || vaultAddress === '0x0000000000000000000000000000000000000000') {
        logger.warn('⚠️ Vault address is zero, falling back to Diamond');
        vaultAddress = DIAMOND;
      }

      logger.debug('🔍 Mint flow: Using vault address:', vaultAddress, 'for Hub ID:', hubId.toString());

      // 3. Check and approve DAI for the vault (not Diamond!)
      const daiContract = getDaiTokenContract('base');
      const collateralAmountWei = parseEther(collateralAmount);

      logger.debug('🔍 Checking DAI allowance for vault...');
      const currentAllowance = await client.readContract({
        address: daiContract.address as `0x${string}`,
        abi: daiContract.abi,
        functionName: 'allowance',
        args: [address as `0x${string}`, vaultAddress as `0x${string}`],
      }) as bigint;

      logger.debug('📊 Current DAI allowance for vault:', {
        vaultAddress,
        currentAllowance: currentAllowance.toString(),
        required: collateralAmountWei.toString(),
        hasEnough: currentAllowance >= collateralAmountWei,
      });

      if (currentAllowance < collateralAmountWei) {
        logger.debug('🔓 Approving DAI for vault...', vaultAddress);
        const approveData = encodeFunctionData({
          abi: daiContract.abi,
          functionName: 'approve',
          args: [vaultAddress as `0x${string}`, collateralAmountWei],
        });

        logger.debug('📤 Sending DAI approve UserOp...');
        const approveOp = await client.sendUserOperation({
          uo: {
            target: daiContract.address as `0x${string}`,
            data: appendBuilderCode(approveData),
            value: BigInt(0),
          },
          context: gasContext,
        });

        logger.debug('⏳ Waiting for approval confirmation...', approveOp.hash);
        await client.waitForUserOperationTransaction({
          hash: approveOp.hash,
        });

        logger.debug('✅ DAI approved for vault');
      } else {
        logger.debug('✅ Sufficient DAI allowance already exists for vault');
      }

      // 3b. ALSO Check/Approve DAI for the DIAMOND (Just in case Diamond calls transferFrom directly)
      // This covers the case where Diamond is the spender, or Vault is the spender.
      logger.debug('🔍 Checking DAI allowance for DIAMOND...');
      const diamondAllowance = await client.readContract({
        address: daiContract.address as `0x${string}`,
        abi: daiContract.abi,
        functionName: 'allowance',
        args: [address as `0x${string}`, DIAMOND as `0x${string}`],
      }) as bigint;

      logger.debug('📊 Current DAI allowance for DIAMOND:', {
        DIAMOND,
        currentAllowance: diamondAllowance.toString(),
        required: collateralAmountWei.toString(),
        hasEnough: diamondAllowance >= collateralAmountWei,
      });

      if (diamondAllowance < collateralAmountWei) {
        logger.debug('🔓 Approving DAI for DIAMOND...');
        const approveData = encodeFunctionData({
          abi: daiContract.abi,
          functionName: 'approve',
          args: [DIAMOND as `0x${string}`, collateralAmountWei],
        });

        const approveOp = await client.sendUserOperation({
          uo: {
            target: daiContract.address as `0x${string}`,
            data: appendBuilderCode(approveData),
            value: BigInt(0),
          },
          context: gasContext,
        });

        logger.debug('⏳ Waiting for DIAMOND approval confirmation...', approveOp.hash);
        await client.waitForUserOperationTransaction({
          hash: approveOp.hash,
        });
        logger.debug('✅ DAI approved for DIAMOND');
      } else {
        logger.debug('✅ Sufficient DAI allowance already exists for DIAMOND');
      }

      // Calculate expected mint amount BEFORE sending the transaction
      // This ensures we record the correct token amount in the DB (not the DAI amount)
      let expectedMintAmount = '0';
      try {
        expectedMintAmount = await calculateMeTokensMinted(meTokenAddress, collateralAmount);
        logger.debug(`📊 Calculated expected mint amount: ${expectedMintAmount} MeTokens for ${collateralAmount} DAI`);
      } catch (calcErr) {
        logger.warn('⚠️ Failed to calculate expected mint amount:', calcErr);
      }

      // 4. Now mint with retry logic for timeout errors

      logger.debug('📤 Sending Mint UserOp to DIAMOND...');

      const mintOperation = {
        uo: {
          target: DIAMOND as `0x${string}`,
          data: appendBuilderCode(encodeFunctionData({
            abi: METOKEN_ABI,
            functionName: 'mint',
            args: [meTokenAddress as `0x${string}`, parseEther(collateralAmount), address as `0x${string}`],
          })),
          value: BigInt(0),
        },
      };

      // Retry logic for transaction simulation timeouts
      let operation: any;
      let mintAttempts = 0;
      const maxMintAttempts = 3;
      const baseRetryDelay = 3000; // 3 seconds

      while (mintAttempts < maxMintAttempts) {
        mintAttempts++;
        try {
          logger.debug(`🔄 Mint attempt ${mintAttempts}/${maxMintAttempts}...`);

          // Create a timeout promise (90 seconds per attempt)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Transaction simulation timed out.')), 90000);
          });

          // Race the sendUserOperation with timeout
          const sendMintOpPromise = client.sendUserOperation({
            ...mintOperation,
            context: gasContext,
          });
          operation = await Promise.race([sendMintOpPromise, timeoutPromise]) as any;

          // Success - break out of retry loop
          break;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isTimeoutError = errorMessage.includes('timed out') || errorMessage.includes('timeout');

          if (isTimeoutError && mintAttempts < maxMintAttempts) {
            // Calculate exponential backoff delay
            const retryDelay = baseRetryDelay * Math.pow(2, mintAttempts - 1);
            logger.debug(`⏳ Mint attempt ${mintAttempts} timed out. Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            // Not a timeout error, or we've exhausted retries
            if (isTimeoutError && mintAttempts >= maxMintAttempts) {
              throw new Error('Transaction simulation timed out after multiple retries. The network may be busy. Please try again in a few moments.');
            }
            throw error;
          }
        }
      }

      logger.debug('🎉 Mint UserOp sent! Hash:', operation.hash);
      setIsPending(false);
      setIsConfirming(true);

      logger.debug('⏳ Waiting for Mint transaction confirmation...');
      const txHash = await client.waitForUserOperationTransaction({
        hash: operation.hash,
      });
      logger.debug('✅ Mint transaction confirmed! Hash:', txHash);

      setIsConfirming(false);
      setIsConfirmed(true);

      // Update MeToken data in Supabase via API route (uses service role client)
      const meToken = await meTokenSupabaseService.getMeTokenByAddress(meTokenAddress);
      if (meToken) {
        // Record the transaction with video tracking if provided via API route
        try {
          const response = await fetch(`/api/metokens/${meTokenAddress}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_address: address,
              transaction_type: 'mint',
              amount: parseFloat(expectedMintAmount),
              collateral_amount: parseFloat(collateralAmount),
              transaction_hash: txHash,
              block_number: 0,
              video_id: videoTracking?.video_id,
              playback_id: videoTracking?.playback_id,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to record transaction:', error);
            // Don't throw - transaction succeeded on-chain, just logging failed
          }
        } catch (error) {
          logger.error('Error recording transaction:', error);
          // Don't throw - transaction succeeded on-chain, just logging failed
        }

        // Update user balance in Supabase via API route (uses service role client)
        try {
          // Read actual balance from chain to ensure accuracy
          const actualBalance = await client.readContract({
            address: meTokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
          }) as bigint;

          const newBalance = parseFloat(formatEther(actualBalance));
          logger.debug(`📊 Syncing balance to Supabase: ${newBalance} (Chain balance: ${actualBalance.toString()})`);

          const balanceResponse = await fetch(`/api/metokens/${meTokenAddress}/balance`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_address: address,
              balance: newBalance,
            }),
          });

          if (!balanceResponse.ok) {
            let errorMsg = 'Unknown error';
            try {
              const errorBody = await balanceResponse.text();
              errorMsg = errorBody;
              try {
                // Try to format JSON for better readability
                errorMsg = JSON.stringify(JSON.parse(errorBody), null, 2);
              } catch { }
            } catch (readErr) {
              errorMsg = `Could not read response body: ${readErr}`;
            }
            logger.error(`Failed to update user balance (Status: ${balanceResponse.status}): ${errorMsg}`);
            // Don't throw - transaction succeeded on-chain, just logging failed
          } else {
            logger.debug('✅ User balance synced to Supabase successfully');
          }
        } catch (error) {
          logger.warn('⚠️ Error updating user balance in Supabase:', error);
          // Don't throw - transaction succeeded on-chain, just logging failed
        }
      }

      setIsConfirming(false);
      setIsConfirmed(true);

      // Refresh data
      await checkUserMeToken();
      return txHash;
    } catch (err) {
      logger.error('❌ Error in buyMeTokens:', err);
      setIsPending(false);
      setIsConfirming(false);
      const error = err instanceof Error ? err : new Error('Failed to buy MeTokens');
      setTransactionError(error);
      throw error;
    }
  };

  // Ensure DAI approval for the meTokens vault
  const ensureDaiApproval = async (meTokenAddress: string, collateralAmount: string) => {
    if (!client || !address) throw new Error('Client or address not available');

    try {
      // Get the vault address that will actually perform transferFrom
      // 1. Get meToken's hubId
      logger.debug('🔍 ensureDaiApproval: Fetching Hub ID for token:', meTokenAddress);
      const meTokenInfo = await client.readContract({
        address: DIAMOND,
        abi: METOKEN_ABI,
        functionName: 'getMeTokenInfo',
        args: [meTokenAddress as `0x${string}`],
      }) as any;

      const hubId = meTokenInfo.hubId || meTokenInfo[1] || BigInt(1);

      // 2. Get vault address for this hub
      logger.debug('🔍 ensureDaiApproval: Fetching Vault for Hub ID:', hubId.toString());
      const hubInfo = await client.readContract({
        address: DIAMOND,
        abi: METOKEN_ABI,
        functionName: 'getHubInfo',
        args: [hubId],
      }) as any;

      // Extract vault address (index 6 in the tuple)
      let vaultAddress: string;
      if (Array.isArray(hubInfo)) {
        vaultAddress = hubInfo[6] as string;
      } else if (typeof hubInfo === 'object' && 'vault' in hubInfo) {
        vaultAddress = hubInfo.vault as string;
      } else {
        vaultAddress = (hubInfo as any)[6] || (hubInfo as any).vault;
      }

      // Fallback to Diamond if vault is zero address (shouldn't happen, but safe)
      if (!vaultAddress || vaultAddress === '0x0000000000000000000000000000000000000000') {
        logger.warn('⚠️ Vault address is zero, falling back to Diamond');
        vaultAddress = DIAMOND;
      }

      logger.debug('🔍 ensureDaiApproval: Using vault address:', vaultAddress, 'for Hub ID:', hubId.toString());

      const daiContract = getDaiTokenContract('base');
      const requiredAmount = parseEther(collateralAmount);

      // Check current allowance for vault (not Diamond!)
      const currentAllowance = await client.readContract({
        address: daiContract.address as `0x${string}`,
        abi: daiContract.abi,
        functionName: 'allowance',
        args: [address as `0x${string}`, vaultAddress as `0x${string}`],
      }) as bigint;

      logger.debug('📊 Current DAI allowance for vault:', {
        vaultAddress,
        currentAllowance: currentAllowance.toString(),
        required: requiredAmount.toString(),
        hasEnough: currentAllowance >= requiredAmount,
      });

      // If allowance is insufficient, approve the vault to spend DAI
      if (currentAllowance < requiredAmount) {
        logger.debug('🔓 Approving DAI for vault...', vaultAddress);
        const operation = await client.sendUserOperation({
          uo: {
            target: daiContract.address as `0x${string}`,
            data: appendBuilderCode(encodeFunctionData({
              abi: daiContract.abi,
              functionName: 'approve',
              args: [vaultAddress as `0x${string}`, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')], // Max approval
            })),
            value: BigInt(0),
          },
        });

        logger.debug('⏳ Waiting for approval confirmation...', operation.hash);
        await client.waitForUserOperationTransaction({
          hash: operation.hash,
        });

        logger.debug('✅ DAI approved for vault');
      } else {
        logger.debug('✅ Sufficient DAI allowance already exists for vault');
      }
    } catch (err) {
      logger.error('Failed to ensure DAI approval:', err);
      throw new Error('Failed to approve DAI spending');
    }
  };

  // Calculate assets returned
  const calculateAssetsReturned = async (meTokenAddress: string, meTokenAmount: string): Promise<string> => {
    try {
      if (!client || !address) {
        logger.warn('⚠️ calculateAssetsReturned: Missing client or address', { hasClient: !!client, address });
        return '0';
      }

      logger.debug('📊 calculateAssetsReturned input:', {
        meTokenAddress,
        meTokenAmount,
        meTokenAmountWei: parseEther(meTokenAmount).toString(),
        senderAddress: address,
        diamondAddress: DIAMOND
      });

      const result = await client.readContract({
        address: DIAMOND,
        abi: METOKEN_ABI,
        functionName: 'calculateAssetsReturned',
        args: [meTokenAddress as `0x${string}`, parseEther(meTokenAmount), address as `0x${string}`],
      });

      const assetsReturned = formatEther(result as bigint);
      logger.debug('✅ calculateAssetsReturned result:', {
        resultWei: (result as bigint).toString(),
        assetsReturned,
        meTokenAmount
      });

      return assetsReturned;
    } catch (err) {
      logger.error('❌ Failed to calculate assets returned:', err);
      logger.error('❌ Error details:', {
        meTokenAddress,
        meTokenAmount,
        address,
        error: err instanceof Error ? err.message : String(err)
      });
      return '0';
    }
  };

  // Sell MeTokens
  const sellMeTokens = async (meTokenAddress: string, meTokenAmount: string) => {
    if (!address || !user) throw new Error('No wallet connected');
    if (!client) throw new Error('Smart account client not initialized');

    setIsPending(true);
    setIsConfirming(false);
    setTransactionError(null);

    try {
      logger.debug('💸 Sell requested:', { meTokenAddress, meTokenAmount });
      const sellAmountWei = parseEther(meTokenAmount);

      // Get the vault address that will actually perform transferFrom (same pattern as buyMeTokens)
      // 1. Get meToken's hubId
      const meTokenInfo = await client.readContract({
        address: DIAMOND,
        abi: METOKEN_ABI,
        functionName: 'getMeTokenInfo',
        args: [meTokenAddress as `0x${string}`],
      }) as any;

      const hubId = meTokenInfo.hubId || meTokenInfo[1] || BigInt(1);

      // 2. Get vault address for this hub
      logger.debug('🔍 Fetching Vault address for Hub ID:', hubId.toString());
      const hubInfo = await client.readContract({
        address: DIAMOND,
        abi: METOKEN_ABI,
        functionName: 'getHubInfo',
        args: [hubId],
      }) as any;

      logger.debug('🔍 Raw Hub Info:', hubInfo);

      // Extract vault address (index 6 in the tuple)
      let vaultAddress: string;
      if (Array.isArray(hubInfo)) {
        vaultAddress = hubInfo[6] as string;
      } else if (typeof hubInfo === 'object' && 'vault' in hubInfo) {
        vaultAddress = hubInfo.vault as string;
      } else {
        vaultAddress = (hubInfo as any)[6] || (hubInfo as any).vault;
      }

      // Fallback to Diamond if vault is zero address (shouldn't happen, but safe)
      if (!vaultAddress || vaultAddress === '0x0000000000000000000000000000000000000000') {
        logger.warn('⚠️ Vault address is zero, falling back to Diamond');
        vaultAddress = DIAMOND;
      }

      logger.debug('🔍 Burn flow: Using vault address:', vaultAddress, 'for Hub ID:', hubId.toString());

      // 3. Check and approve MeToken for the vault (not Diamond!)
      logger.debug('🔍 Checking MeToken allowance for vault...');
      const currentAllowance = await client.readContract({
        address: meTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, vaultAddress as `0x${string}`],
      }) as bigint;

      logger.debug('📊 Current MeToken allowance for vault:', {
        vaultAddress,
        currentAllowance: currentAllowance.toString(),
        required: sellAmountWei.toString(),
        hasEnough: currentAllowance >= sellAmountWei,
      });

      if (currentAllowance < sellAmountWei) {
        logger.debug('🔓 Approving MeToken for vault...', vaultAddress);
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [vaultAddress as `0x${string}`, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
        });

        logger.debug('📤 Sending MeToken approve UserOp...');
        const approveOp = await client.sendUserOperation({
          uo: {
            target: meTokenAddress as `0x${string}`,
            data: appendBuilderCode(approveData),
            value: BigInt(0),
          },
        });

        logger.debug('⏳ Waiting for approval confirmation...', approveOp.hash);
        await client.waitForUserOperationTransaction({
          hash: approveOp.hash,
        });

        logger.debug('✅ MeToken approved for vault');
      } else {
        logger.debug('✅ Sufficient MeToken allowance already exists for vault');
      }

      // 3b. ALSO Check/Approve MeToken for the DIAMOND (Just in case Diamond calls transferFrom directly)
      // This covers the case where Diamond is the spender, or Vault is the spender.
      logger.debug('🔍 Checking MeToken allowance for DIAMOND...');
      const diamondAllowance = await client.readContract({
        address: meTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, DIAMOND as `0x${string}`],
      }) as bigint;

      logger.debug('📊 Current MeToken allowance for DIAMOND:', {
        DIAMOND,
        currentAllowance: diamondAllowance.toString(),
        required: sellAmountWei.toString(),
        hasEnough: diamondAllowance >= sellAmountWei,
      });

      if (diamondAllowance < sellAmountWei) {
        logger.debug('🔓 Approving MeToken for DIAMOND...');
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [DIAMOND as `0x${string}`, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
        });

        const approveOp = await client.sendUserOperation({
          uo: {
            target: meTokenAddress as `0x${string}`,
            data: appendBuilderCode(approveData),
            value: BigInt(0),
          },
        });

        logger.debug('⏳ Waiting for DIAMOND approval confirmation...', approveOp.hash);
        await client.waitForUserOperationTransaction({
          hash: approveOp.hash,
        });
        logger.debug('✅ MeToken approved for DIAMOND');
      } else {
        logger.debug('✅ Sufficient MeToken allowance already exists for DIAMOND');
      }

      // Calculate collateral amount returned BEFORE the burn (more accurate)
      // This gives us the expected collateral amount before supply changes
      let collateralAmountReturned = 0;
      try {
        const assetsReturnedStr = await calculateAssetsReturned(meTokenAddress, meTokenAmount);
        collateralAmountReturned = parseFloat(assetsReturnedStr) || 0;
        logger.debug('📊 Calculated collateral amount to be returned:', collateralAmountReturned);
      } catch (calcError) {
        logger.warn('⚠️ Failed to calculate collateral amount returned before burn:', calcError);
        // Continue - we'll try to calculate it again after if needed
      }

      // Send burn operation with retry logic for timeout errors
      logger.debug('📤 Sending Burn UserOp to DIAMOND...');

      const burnOperation = {
        uo: {
          target: DIAMOND as `0x${string}`,
          data: appendBuilderCode(encodeFunctionData({
            abi: METOKEN_ABI,
            functionName: 'burn',
            args: [meTokenAddress as `0x${string}`, sellAmountWei, address as `0x${string}`],
          })),
          value: BigInt(0),
        },
      };

      // Retry logic for transaction simulation timeouts
      let operation: any;
      let burnAttempts = 0;
      const maxBurnAttempts = 3;
      const baseRetryDelay = 3000; // 3 seconds

      while (burnAttempts < maxBurnAttempts) {
        burnAttempts++;
        try {
          logger.debug(`🔄 Burn attempt ${burnAttempts}/${maxBurnAttempts}...`);

          // Create a timeout promise (90 seconds per attempt)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Transaction simulation timed out.')), 90000);
          });

          // Race the sendUserOperation with timeout
          const sendBurnOpPromise = client.sendUserOperation(burnOperation);
          operation = await Promise.race([sendBurnOpPromise, timeoutPromise]) as any;

          // Success - break out of retry loop
          break;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isTimeoutError = errorMessage.includes('timed out') || errorMessage.includes('timeout');

          if (isTimeoutError && burnAttempts < maxBurnAttempts) {
            // Calculate exponential backoff delay
            const retryDelay = baseRetryDelay * Math.pow(2, burnAttempts - 1);
            logger.debug(`⏳ Burn attempt ${burnAttempts} timed out. Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            // Not a timeout error, or we've exhausted retries
            if (isTimeoutError && burnAttempts >= maxBurnAttempts) {
              throw new Error('Transaction simulation timed out after multiple retries. The network may be busy. Please try again in a few moments.');
            }
            throw error;
          }
        }
      }

      logger.debug('🎉 Burn UserOp sent! Hash:', operation.hash);
      setIsPending(false);
      setIsConfirming(true);

      logger.debug('⏳ Waiting for Burn transaction confirmation...');
      const txHash = await client.waitForUserOperationTransaction({
        hash: operation.hash,
      });
      logger.debug('✅ Burn transaction confirmed! Hash:', txHash);

      setIsConfirming(false);
      setIsConfirmed(true);

      // Update MeToken data in Supabase via API route (uses service role client)
      const meToken = await meTokenSupabaseService.getMeTokenByAddress(meTokenAddress);
      if (meToken) {
        // Record the transaction via API route
        // Note: collateralAmountReturned was calculated before the burn for accuracy
        try {
          const response = await fetch(`/api/metokens/${meTokenAddress}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_address: address,
              transaction_type: 'burn',
              amount: parseFloat(meTokenAmount),
              collateral_amount: collateralAmountReturned > 0 ? collateralAmountReturned : undefined,
              transaction_hash: txHash,
              block_number: 0,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to record transaction:', error);
            // Don't throw - transaction succeeded on-chain, just logging failed
          }
        } catch (error) {
          logger.error('Error recording transaction:', error);
          // Don't throw - transaction succeeded on-chain, just logging failed
        }

        // Update user balance in Supabase via API route (uses service role client)
        try {
          // Read actual balance from chain to ensure accuracy
          const actualBalance = await client.readContract({
            address: meTokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
          }) as bigint;

          const newBalance = parseFloat(formatEther(actualBalance));
          logger.debug(`📊 Syncing balance to Supabase: ${newBalance} (Chain balance: ${actualBalance.toString()})`);

          const balanceResponse = await fetch(`/api/metokens/${meTokenAddress}/balance`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_address: address,
              balance: newBalance,
            }),
          });

          if (!balanceResponse.ok) {
            let errorMsg = 'Unknown error';
            try {
              const errorBody = await balanceResponse.text();
              errorMsg = errorBody;
              try {
                // Try to format JSON for better readability
                errorMsg = JSON.stringify(JSON.parse(errorBody), null, 2);
              } catch { }
            } catch (readErr) {
              errorMsg = `Could not read response body: ${readErr}`;
            }
            logger.error(`Failed to update user balance (Status: ${balanceResponse.status}): ${errorMsg}`);
            // Don't throw - transaction succeeded on-chain, just logging failed
          } else {
            logger.debug('✅ User balance synced to Supabase successfully');
          }
        } catch (error) {
          logger.error('Error updating user balance:', error);
          // Don't throw - transaction succeeded on-chain, just logging failed
        }
      }

      setIsConfirming(false);
      setIsConfirmed(true);

      // Refresh data
      await checkUserMeToken();
      return txHash;
    } catch (err) {
      logger.error('❌ Error in sellMeTokens:', err);
      setIsPending(false);
      setIsConfirming(false);
      const error = err instanceof Error ? err : new Error('Failed to sell MeTokens');
      setTransactionError(error);
      throw error;
    }
  };

  // Calculate MeTokens to be minted
  const calculateMeTokensMinted = async (meTokenAddress: string, collateralAmount: string): Promise<string> => {
    try {
      if (!client) return '0';

      const result = await client.readContract({
        address: DIAMOND,
        abi: METOKEN_ABI,
        functionName: 'calculateMeTokensMinted',
        args: [meTokenAddress as `0x${string}`, parseEther(collateralAmount)],
      });

      return formatEther(result as bigint);
    } catch (err) {
      logger.error('Failed to calculate MeTokens minted:', err);
      return '0';
    }
  };

  // Check for a specific MeToken by address
  const checkSpecificMeToken = async (meTokenAddress: string) => {
    if (!address || !client) return null;

    try {
      const supabaseMeToken = await meTokenSupabaseService.getMeTokenByAddress(meTokenAddress);

      if (supabaseMeToken) {
        const ownerLower = supabaseMeToken.owner_address.toLowerCase();
        const addressLower = address.toLowerCase();
        const eoaLower = user?.address?.toLowerCase();

        // Check if the MeToken belongs to either the current address OR the user's EOA
        if (ownerLower === addressLower || (eoaLower && ownerLower === eoaLower)) {
          logger.debug('✅ MeToken belongs to user (owner:', supabaseMeToken.owner_address, ')');
          const meTokenData = await convertToMeTokenData(supabaseMeToken, address || '');
          setUserMeToken(meTokenData);
          return meTokenData;
        }

        logger.debug('❌ MeToken owner mismatch:', {
          meTokenOwner: supabaseMeToken.owner_address,
          profileAddress: address,
          userEOA: user?.address
        });
      }

      return null;
    } catch (err) {
      logger.error(`Failed to check MeToken ${meTokenAddress}:`, err);
      return null;
    }
  };

  // Keep a stable reference to checkUserMeToken to avoid infinite re-subscriptions
  const checkUserMeTokenRef = useRef(checkUserMeToken);

  useEffect(() => {
    checkUserMeTokenRef.current = checkUserMeToken;
  }, [checkUserMeToken]);

  // Subscribe to real-time updates (only re-subscribe when address changes)
  useEffect(() => {
    if (!address) return;

    const subscription = meTokenSupabaseService.subscribeToBalanceUpdates(address, (payload) => {
      logger.debug('Balance update received:', payload);
      // Use the ref to call the latest version without causing re-subscriptions
      checkUserMeTokenRef.current();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [address]); // Only depend on address, not checkUserMeToken

  // Initial fetch when address changes
  useEffect(() => {
    if (address) {
      checkUserMeToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]); // Only run when address changes, not when checkUserMeToken changes

  return {
    userMeToken,
    loading,
    error: meTokenError,
    createMeToken,
    buyMeTokens,
    sellMeTokens,
    calculateMeTokensMinted,
    calculateAssetsReturned,
    checkSpecificMeToken,
    checkUserMeToken, // Expose this function for manual refresh
    isPending,
    isConfirming,
    isConfirmed,
    transactionError,
    getMeTokenVaultAddress: async (meTokenAddress: string) => {
      if (!client) return null;
      try {
        const meTokenInfo = await client.readContract({
          address: DIAMOND,
          abi: METOKEN_ABI,
          functionName: 'getMeTokenInfo',
          args: [meTokenAddress as `0x${string}`],
        });
        const hubId = (meTokenInfo as any).hubId;
        const hubInfo = await client.readContract({
          address: DIAMOND,
          abi: METOKEN_ABI,
          functionName: 'getHubInfo',
          args: [hubId],
        });
        return (hubInfo as any).vault as string;
      } catch (error) {
        logger.error('Failed to get vault address:', error);
        return null;
      }
    },
    ensureDaiApproval
  };
}
