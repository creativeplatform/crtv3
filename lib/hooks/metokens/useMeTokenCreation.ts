/**
 * useMeTokenCreation Hook - Robust MeToken Creation with Timeout Handling
 * 
 * This hook implements a "fire-and-forget" pattern with background polling
 * to handle blockchain transaction timeouts gracefully.
 * 
 * Key Features:
 * 1. Optimistic UI updates - shows progress immediately
 * 2. Background transaction polling - doesn't block on waitForUserOperationTransaction
 * 3. Transaction persistence - survives page refreshes
 * 4. Automatic retry and recovery - finds MeTokens created from timed-out transactions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser, useSmartAccountClient } from '@account-kit/react';
import { useGasSponsorship } from '@/lib/hooks/wallet/useGasSponsorship';
import { parseEther, formatEther, encodeFunctionData, decodeEventLog } from 'viem';
import { parseBundlerError, shouldRetryError } from '@/lib/utils/bundlerErrorParser';
import { getDaiTokenContract, DAI_TOKEN_ADDRESSES } from '@/lib/contracts/DAIToken';
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


// MeTokens contract addresses on Base
const DIAMOND = '0xba5502db2aC2cBff189965e991C07109B14eB3f5' as const;
const METOKEN_FACTORY = '0x7BE650f4AA109377c1bBbEE0851CF72A8e7E915C' as const;

// Subscribe ABI
const SUBSCRIBE_ABI = [{
  inputs: [
    { internalType: 'string', name: 'name', type: 'string' },
    { internalType: 'string', name: 'symbol', type: 'string' },
    { internalType: 'uint256', name: 'hubId', type: 'uint256' },
    { internalType: 'uint256', name: 'assetsDeposited', type: 'uint256' }
  ],
  name: 'subscribe',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function'
}] as const;

// Subscribe event ABI for parsing logs
const SUBSCRIBE_EVENT_ABI = [{
  anonymous: false,
  inputs: [
    { indexed: true, internalType: 'address', name: 'meToken', type: 'address' },
    { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
    { indexed: false, internalType: 'uint256', name: 'minted', type: 'uint256' },
    { indexed: false, internalType: 'address', name: 'asset', type: 'address' },
    { indexed: false, internalType: 'uint256', name: 'assetsDeposited', type: 'uint256' },
    { indexed: false, internalType: 'string', name: 'name', type: 'string' },
    { indexed: false, internalType: 'string', name: 'symbol', type: 'string' },
    { indexed: false, internalType: 'uint256', name: 'hubId', type: 'uint256' }
  ],
  name: 'Subscribe',
  type: 'event'
}] as const;

// DAI Approve ABI
const DAI_APPROVE_ABI = [{
  inputs: [
    { internalType: 'address', name: 'spender', type: 'address' },
    { internalType: 'uint256', name: 'amount', type: 'uint256' }
  ],
  name: 'approve',
  outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
  stateMutability: 'nonpayable',
  type: 'function'
}] as const;

// Hub Info ABI
const HUB_INFO_ABI = [{
  inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
  name: 'getHubInfo',
  outputs: [{
    components: [
      { internalType: 'uint256', name: 'startTime', type: 'uint256' },
      { internalType: 'uint256', name: 'endTime', type: 'uint256' },
      { internalType: 'uint256', name: 'endCooldown', type: 'uint256' },
      { internalType: 'uint256', name: 'refundRatio', type: 'uint256' },
      { internalType: 'uint256', name: 'targetRefundRatio', type: 'uint256' },
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'vault', type: 'address' },
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'bool', name: 'updating', type: 'bool' },
      { internalType: 'bool', name: 'reconfigure', type: 'bool' },
      { internalType: 'bool', name: 'active', type: 'bool' }
    ],
    internalType: 'struct HubInfo',
    name: '',
    type: 'tuple'
  }],
  stateMutability: 'view',
  type: 'function'
}] as const;

// Transaction status for persistence
export interface PendingMeTokenTransaction {
  userOpHash: string;
  creatorAddress: string;
  name: string;
  symbol: string;
  hubId: number;
  assetsDeposited: string;
  createdAt: number;
  status: 'pending' | 'confirming' | 'confirmed' | 'failed' | 'timeout';
  txHash?: string;
  meTokenAddress?: string;
  errorMessage?: string;
}

// Storage key for persisting pending transactions
const PENDING_TX_KEY = 'metoken_pending_transactions';

// Creation status
export type CreationStatus =
  | 'idle'
  | 'checking_balance'
  | 'approving_dai'
  | 'waiting_approval'
  | 'creating_metoken'
  | 'waiting_confirmation'
  | 'polling_status'
  | 'success'
  | 'error';

export interface MeTokenCreationState {
  status: CreationStatus;
  message: string;
  progress: number;
  userOpHash?: string;
  txHash?: string;
  meTokenAddress?: string;
  meTokenId?: string;
  error?: string;
}

export interface UseMeTokenCreationReturn {
  state: MeTokenCreationState;
  createMeToken: (params: {
    name: string;
    symbol: string;
    hubId: number;
    assetsDeposited: string;
  }) => Promise<void>;
  checkPendingTransactions: () => Promise<void>;
  pendingTransactions: PendingMeTokenTransaction[];
  clearPendingTransaction: (userOpHash: string) => void;
  retryPendingTransaction: (tx: PendingMeTokenTransaction) => Promise<void>;
}

/**
 * Save pending transaction to localStorage
 */
function savePendingTransaction(tx: PendingMeTokenTransaction): void {
  try {
    const existing = getPendingTransactions();
    const updated = existing.filter(t => t.userOpHash !== tx.userOpHash);
    updated.push(tx);
    localStorage.setItem(PENDING_TX_KEY, JSON.stringify(updated));
  } catch (e) {
    logger.error('Failed to save pending transaction:', e);
  }
}

/**
 * Get pending transactions from localStorage
 */
function getPendingTransactions(): PendingMeTokenTransaction[] {
  try {
    const stored = localStorage.getItem(PENDING_TX_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    logger.error('Failed to get pending transactions:', e);
    return [];
  }
}

/**
 * Remove pending transaction from localStorage
 */
function removePendingTransaction(userOpHash: string): void {
  try {
    const existing = getPendingTransactions();
    const updated = existing.filter(t => t.userOpHash !== userOpHash);
    localStorage.setItem(PENDING_TX_KEY, JSON.stringify(updated));
  } catch (e) {
    logger.error('Failed to remove pending transaction:', e);
  }
}

/**
 * Main hook for robust MeToken creation
 */
export function useMeTokenCreation(): UseMeTokenCreationReturn {
  const user = useUser();
  const { client } = useSmartAccountClient({});
  const { getGasContext, isMember } = useGasSponsorship();

  const [state, setState] = useState<MeTokenCreationState>({
    status: 'idle',
    message: '',
    progress: 0,
  });

  const [pendingTransactions, setPendingTransactions] = useState<PendingMeTokenTransaction[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const address = user?.address;

  // Load pending transactions on mount
  useEffect(() => {
    setPendingTransactions(getPendingTransactions());
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  /**
   * Update state helper
   */
  const updateState = useCallback((partial: Partial<MeTokenCreationState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  /**
   * Poll for transaction status using subgraph
   */
  const pollForMeToken = useCallback(async (
    tx: PendingMeTokenTransaction,
    maxAttempts: number = 30 // 5 minutes at 10s intervals
  ): Promise<string | null> => {
    let attempts = 0;

    return new Promise((resolve) => {
      const poll = async () => {
        attempts++;
        logger.debug(`🔄 Polling for MeToken (attempt ${attempts}/${maxAttempts})...`);

        try {
          // Query subgraph for MeTokens owned by this address
          const { meTokensSubgraph } = await import('@/lib/sdk/metokens/subgraph');
          const allMeTokens = await meTokensSubgraph.getAllMeTokens(50, 0);

          // Check if any MeToken matches our creator address
          for (const meToken of allMeTokens) {
            try {
              // Verify ownership via Diamond contract
              if (client) {
                const info = await client.readContract({
                  address: DIAMOND,
                  abi: [{
                    inputs: [{ internalType: 'address', name: 'meToken', type: 'address' }],
                    name: 'getMeTokenInfo',
                    outputs: [{
                      components: [
                        { internalType: 'address', name: 'owner', type: 'address' },
                        { internalType: 'uint256', name: 'hubId', type: 'uint256' },
                        { internalType: 'uint256', name: 'balancePooled', type: 'uint256' },
                        { internalType: 'uint256', name: 'balanceLocked', type: 'uint256' },
                        { internalType: 'uint256', name: 'startTime', type: 'uint256' },
                        { internalType: 'uint256', name: 'endTime', type: 'uint256' },
                        { internalType: 'uint256', name: 'targetHubId', type: 'uint256' },
                        { internalType: 'address', name: 'migration', type: 'address' }
                      ],
                      internalType: 'struct MeTokenInfo',
                      name: '',
                      type: 'tuple'
                    }],
                    stateMutability: 'view',
                    type: 'function'
                  }],
                  functionName: 'getMeTokenInfo',
                  args: [meToken.id as `0x${string}`],
                }) as { owner: string };

                if (info.owner.toLowerCase() === tx.creatorAddress.toLowerCase()) {
                  logger.debug('✅ Found MeToken via polling:', meToken.id);
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                  resolve(meToken.id);
                  return;
                }
              }
            } catch (err) {
              // Continue checking other tokens
            }
          }

          if (attempts >= maxAttempts) {
            logger.debug('⏰ Polling timed out after max attempts');
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            resolve(null);
          }
        } catch (err) {
          logger.error('❌ Polling error:', err);
          if (attempts >= maxAttempts) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            resolve(null);
          }
        }
      };

      // Poll every 10 seconds
      pollingRef.current = setInterval(poll, 10000);
      // Also poll immediately
      poll();
    });
  }, [client]);

  /**
   * Get vault address for a hub
   */
  const getVaultAddress = useCallback(async (hubId: number): Promise<string | null> => {
    if (!client) return null;

    try {
      const hubInfo = await client.readContract({
        address: DIAMOND,
        abi: HUB_INFO_ABI,
        functionName: 'getHubInfo',
        args: [BigInt(hubId)],
      }) as { vault: string };

      return hubInfo.vault;
    } catch (err) {
      logger.error('Failed to get vault address:', err);
      return null;
    }
  }, [client]);

  /**
   * Approve DAI for the vault
   */
  const approveDai = useCallback(async (
    vaultAddress: string,
    amount: bigint
  ): Promise<string> => {
    if (!client || !address) throw new Error('Client or address not available');

    const daiContract = getDaiTokenContract('base');

    // Check current allowance
    const currentAllowance = await client.readContract({
      address: daiContract.address as `0x${string}`,
      abi: daiContract.abi,
      functionName: 'allowance',
      args: [address as `0x${string}`, vaultAddress as `0x${string}`],
    }) as bigint;

    if (currentAllowance >= amount) {
      logger.debug('✅ Sufficient DAI allowance already exists');
      return 'skipped';
    }

    logger.debug('🔓 Approving DAI for vault...');

    const approveData = encodeFunctionData({
      abi: DAI_APPROVE_ABI,
      functionName: 'approve',
      args: [vaultAddress as `0x${string}`, amount],
    });

    const gasContext = getGasContext('usdc');

    // Send approval with timeout
    const approvePromise = client.sendUserOperation({
      uo: {
        target: daiContract.address as `0x${string}`,
        data: appendBuilderCode(approveData),
        value: BigInt(0),
      },
      context: gasContext.context,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('DAI approval timed out after 90 seconds')), 90000);
    });

    const approveOp = await Promise.race([approvePromise, timeoutPromise]);

    logger.debug('⏳ Waiting for approval confirmation...');

    // Wait with timeout
    const waitPromise = client.waitForUserOperationTransaction({
      hash: approveOp.hash,
    });

    const waitTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Approval confirmation timed out after 120 seconds')), 120000);
    });

    const txHash = await Promise.race([waitPromise, waitTimeoutPromise]);

    logger.debug('✅ DAI approval confirmed:', txHash);

    // Verify the approval with retries
    let verified = false;
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000 + i * 1000));

      const newAllowance = await client.readContract({
        address: daiContract.address as `0x${string}`,
        abi: daiContract.abi,
        functionName: 'allowance',
        args: [address as `0x${string}`, vaultAddress as `0x${string}`],
      }) as bigint;

      if (newAllowance >= amount) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      throw new Error('DAI approval verification failed after multiple attempts');
    }

    return txHash;
  }, [client, address, getGasContext]);

  /**
   * Main create MeToken function
   */
  const createMeToken = useCallback(async (params: {
    name: string;
    symbol: string;
    hubId: number;
    assetsDeposited: string;
  }) => {
    if (!client || !address) {
      updateState({
        status: 'error',
        message: 'Wallet not connected',
        error: 'Please connect your wallet to create a MeToken.',
        progress: 0
      });
      throw new Error('Wallet not connected');
    }

    const { name, symbol, hubId, assetsDeposited } = params;
    const depositAmount = parseEther(assetsDeposited || '0');

    try {
      // Step 1: Check balance
      updateState({
        status: 'checking_balance',
        message: 'Checking DAI balance...',
        progress: 10,
      });

      if (depositAmount > BigInt(0)) {
        const daiContract = getDaiTokenContract('base');

        const balance = await client.readContract({
          address: daiContract.address as `0x${string}`,
          abi: daiContract.abi,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }) as bigint;

        if (balance < depositAmount) {
          throw new Error(`Insufficient DAI balance. You have ${formatEther(balance)} DAI but need ${formatEther(depositAmount)} DAI.`);
        }

        // Step 2: Get vault and approve DAI
        updateState({
          status: 'approving_dai',
          message: 'Getting vault address...',
          progress: 20,
        });

        const vaultAddress = await getVaultAddress(hubId);

        if (vaultAddress && vaultAddress !== '0x0000000000000000000000000000000000000000') {
          updateState({
            status: 'approving_dai',
            message: 'Approving DAI for vault...',
            progress: 30,
          });

          await approveDai(vaultAddress, depositAmount);
        }

        // Also approve Diamond as fallback
        updateState({
          status: 'approving_dai',
          message: 'Approving DAI for Diamond contract...',
          progress: 40,
        });

        await approveDai(DIAMOND, depositAmount);
      }

      // Step 3: Create MeToken via subscribe
      updateState({
        status: 'creating_metoken',
        message: 'Creating your MeToken...',
        progress: 50,
      });

      const subscribeData = encodeFunctionData({
        abi: SUBSCRIBE_ABI,
        functionName: 'subscribe',
        args: [name, symbol, BigInt(hubId), depositAmount],
      });

      const gasContext = getGasContext('usdc');

      logger.debug('📤 Sending subscribe user operation...');
      logger.debug('🔍 Gas sponsorship context:', {
        isMember,
        isSponsored: gasContext.isSponsored,
        hasContext: !!gasContext.context,
        context: gasContext.context,
        policyId: gasContext.context?.paymasterService?.policyId,
      });

      // Send the operation without blocking on a long timeout
      let operation: { hash: `0x${string}` };
      try {
        const sendPromise = client.sendUserOperation({
          uo: {
            target: DIAMOND,
            data: appendBuilderCode(subscribeData),
            value: BigInt(0),
          },
          context: gasContext.context,
        });

        // Short timeout for sending - just to get the userOpHash
        const sendTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Sending operation timed out')), 60000);
        });

        operation = await Promise.race([sendPromise, sendTimeoutPromise]);
      } catch (sendError) {
        // Check if this is an account deployment error (AA13)
        const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
        const isDeploymentError = errorMessage.includes('AA13') ||
          errorMessage.includes('initCode') ||
          errorMessage.includes('account not deployed');

        // Handle account deployment - paymasters can't sponsor deployment transactions
        if (isDeploymentError && gasContext.context) {
          logger.debug('⚠️ Account deployment detected. Paymasters cannot sponsor deployment transactions. Retrying without paymaster...');

          // Check ETH balance before deploying without paymaster
          const ethBalance = await client.getBalance({ address });
          const minGasEth = parseEther('0.001');

          if (ethBalance < minGasEth) {
            const deployErrorMessage = `Your smart account needs to be deployed first, but deployment requires ETH for gas. ` +
              `Your account has ${formatEther(ethBalance)} ETH but needs at least ${formatEther(minGasEth)} ETH for deployment. ` +
              `Please send at least ${formatEther(minGasEth)} ETH to your account address: ${address}`;

            updateState({
              status: 'error',
              message: 'Account deployment required',
              error: deployErrorMessage,
              progress: 50,
            });

            throw new Error(deployErrorMessage);
          }

          // Try deployment without paymaster
          logger.debug('🔄 Retrying account deployment without paymaster...');
          try {
            const deployPromise = client.sendUserOperation({
              uo: {
                target: DIAMOND,
                data: appendBuilderCode(subscribeData),
                value: BigInt(0),
              },
            });

            const deployTimeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Deployment operation timed out')), 60000);
            });

            operation = await Promise.race([deployPromise, deployTimeoutPromise]);
            logger.debug('✅ Account deployment succeeded!');
          } catch (deployError) {
            // Deployment failed even without paymaster
            const deployFailMessage = `Account deployment failed. This may require manual funding. ` +
              `Please send at least ${formatEther(minGasEth)} ETH to your account: ${address}`;

            updateState({
              status: 'error',
              message: 'Account deployment failed',
              error: deployFailMessage,
              progress: 50,
            });

            throw new Error(deployFailMessage);
          }
        } else if (gasContext.context) {
          // Handle other paymaster failures
          // If user is a member, paymaster failure is a configuration issue
          if (gasContext.isSponsored && isMember) {
            const errorMessage = `Paymaster failed for member account. ` +
              `As a member, your gas should be fully sponsored. ` +
              `Please contact support - this appears to be a paymaster configuration issue.`;

            updateState({
              status: 'error',
              message: 'Paymaster configuration error',
              error: errorMessage,
              progress: 50,
            });

            throw new Error(errorMessage);
          }

          // For non-members: USDC paymaster failed, try ETH fallback
          // Only check ETH balance if we're going to retry with ETH
          const ethBalance = await client.getBalance({ address });
          const minGasEth = parseEther('0.001');

          if (ethBalance < minGasEth) {
            // USDC paymaster failed AND user doesn't have ETH
            const errorMessage = `Gas payment failed. ` +
              `USDC paymaster failed and your account has insufficient ETH (${formatEther(ethBalance)} ETH). ` +
              `You need either USDC for the paymaster or at least ${formatEther(minGasEth)} ETH for gas fees. ` +
              `Please fund your account with USDC or ETH.`;

            updateState({
              status: 'error',
              message: 'Insufficient balance for transaction',
              error: errorMessage,
              progress: 50,
            });

            throw new Error(errorMessage);
          }

          // USDC paymaster failed but user has ETH - retry with ETH
          logger.debug('🔄 USDC paymaster failed, retrying with ETH...');
          const fallbackPromise = client.sendUserOperation({
            uo: {
              target: DIAMOND,
              data: appendBuilderCode(subscribeData),
              value: BigInt(0),
            },
          });

          const fallbackTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Fallback operation timed out')), 60000);
          });

          operation = await Promise.race([fallbackPromise, fallbackTimeoutPromise]);
        } else {
          // No paymaster context - was trying ETH directly, just throw the error
          throw sendError;
        }
      }

      logger.debug('🎉 UserOperation sent! Hash:', operation.hash);

      // Save pending transaction for recovery
      const pendingTx: PendingMeTokenTransaction = {
        userOpHash: operation.hash,
        creatorAddress: address,
        name,
        symbol,
        hubId,
        assetsDeposited,
        createdAt: Date.now(),
        status: 'confirming',
      };
      savePendingTransaction(pendingTx);
      setPendingTransactions(prev => [...prev.filter(t => t.userOpHash !== operation.hash), pendingTx]);

      updateState({
        status: 'waiting_confirmation',
        message: 'Waiting for blockchain confirmation...',
        progress: 60,
        userOpHash: operation.hash,
      });

      // Step 4: Wait for confirmation with a moderate timeout, then fall back to polling
      let txHash: string | null = null;

      try {
        const waitPromise = client.waitForUserOperationTransaction({
          hash: operation.hash,
        });

        // 2 minute timeout for waiting
        const waitTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Confirmation timed out')), 120000);
        });

        txHash = await Promise.race([waitPromise, waitTimeoutPromise]);
        logger.debug('✅ Transaction confirmed:', txHash);

        pendingTx.txHash = txHash;
        pendingTx.status = 'confirmed';
        savePendingTransaction(pendingTx);

      } catch (waitError) {
        logger.debug('⏰ Confirmation wait timed out, switching to polling...');

        updateState({
          status: 'polling_status',
          message: 'Transaction is processing. Checking for your MeToken...',
          progress: 70,
          userOpHash: operation.hash,
        });

        pendingTx.status = 'timeout';
        savePendingTransaction(pendingTx);
      }

      // Step 5: Find the created MeToken
      updateState({
        status: 'polling_status',
        message: 'Looking for your newly created MeToken...',
        progress: 80,
        userOpHash: operation.hash,
        txHash: txHash || undefined,
      });

      // Wait a bit for subgraph to index
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Poll for the MeToken
      const meTokenAddress = await pollForMeToken(pendingTx, 30);

      if (meTokenAddress) {
        // Sync to database
        let meTokenId: string | undefined;
        try {
          const syncResponse = await fetch('/api/metokens/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meTokenAddress,
              transactionHash: txHash,
            }),
          });

          if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            meTokenId = syncData.id || syncData.data?.id;
            logger.debug('✅ MeToken synced to database, ID:', meTokenId);
          }
        } catch (syncErr) {
          logger.error('Failed to sync MeToken to database:', syncErr);
        }

        // Update pending transaction
        pendingTx.meTokenAddress = meTokenAddress;
        pendingTx.status = 'confirmed';
        savePendingTransaction(pendingTx);

        // Remove from pending list after short delay
        setTimeout(() => {
          removePendingTransaction(pendingTx.userOpHash);
          setPendingTransactions(prev => prev.filter(t => t.userOpHash !== pendingTx.userOpHash));
        }, 5000);

        updateState({
          status: 'success',
          message: 'MeToken created successfully!',
          progress: 100,
          userOpHash: operation.hash,
          txHash: txHash || undefined,
          meTokenAddress,
          meTokenId, // Include ID in state
        });

        return;
      }

      // If we couldn't find the MeToken but transaction seemed to go through
      if (txHash) {
        updateState({
          status: 'success',
          message: 'Transaction confirmed! Your MeToken should appear shortly.',
          progress: 100,
          userOpHash: operation.hash,
          txHash,
        });
      } else {
        updateState({
          status: 'polling_status',
          message: 'Transaction submitted. Your MeToken will appear once confirmed.',
          progress: 90,
          userOpHash: operation.hash,
        });
      }

    } catch (err) {
      logger.error('❌ MeToken creation failed:', err);

      const parsed = parseBundlerError(err as Error);

      updateState({
        status: 'error',
        message: parsed.message,
        progress: 0,
        error: `${parsed.message}\n\n💡 ${parsed.suggestion}`,
      });

      throw err;
    }
  }, [client, address, getGasContext, getVaultAddress, approveDai, pollForMeToken, updateState]);

  /**
   * Check and recover pending transactions
   */
  const checkPendingTransactions = useCallback(async () => {
    const pending = getPendingTransactions();

    if (pending.length === 0) return;

    logger.debug(`🔍 Checking ${pending.length} pending transactions...`);

    for (const tx of pending) {
      // Skip old transactions (older than 24 hours)
      if (Date.now() - tx.createdAt > 24 * 60 * 60 * 1000) {
        removePendingTransaction(tx.userOpHash);
        continue;
      }

      // Skip already confirmed
      if (tx.status === 'confirmed' && tx.meTokenAddress) {
        continue;
      }

      // Try to find the MeToken
      const meTokenAddress = await pollForMeToken(tx, 3);

      if (meTokenAddress) {
        tx.meTokenAddress = meTokenAddress;
        tx.status = 'confirmed';
        savePendingTransaction(tx);
        setPendingTransactions(prev =>
          prev.map(t => t.userOpHash === tx.userOpHash ? tx : t)
        );
        logger.debug(`✅ Found MeToken for pending tx: ${meTokenAddress}`);
      }
    }

    setPendingTransactions(getPendingTransactions());
  }, [pollForMeToken]);

  /**
   * Clear a pending transaction
   */
  const clearPendingTransaction = useCallback((userOpHash: string) => {
    removePendingTransaction(userOpHash);
    setPendingTransactions(prev => prev.filter(t => t.userOpHash !== userOpHash));
  }, []);

  /**
   * Retry a pending/failed transaction by recreating
   */
  const retryPendingTransaction = useCallback(async (tx: PendingMeTokenTransaction) => {
    // First check if MeToken was already created
    const existing = await pollForMeToken(tx, 3);

    if (existing) {
      tx.meTokenAddress = existing;
      tx.status = 'confirmed';
      savePendingTransaction(tx);
      setPendingTransactions(prev =>
        prev.map(t => t.userOpHash === tx.userOpHash ? tx : t)
      );

      updateState({
        status: 'success',
        message: 'Found your existing MeToken!',
        progress: 100,
        meTokenAddress: existing,
      });

      return;
    }

    // Otherwise create new
    await createMeToken({
      name: tx.name,
      symbol: tx.symbol,
      hubId: tx.hubId,
      assetsDeposited: tx.assetsDeposited,
    });
  }, [createMeToken, pollForMeToken, updateState]);

  // Check for pending transactions on mount
  useEffect(() => {
    if (address) {
      checkPendingTransactions();
    }
  }, [address, checkPendingTransactions]);

  return {
    state,
    createMeToken,
    checkPendingTransactions,
    pendingTransactions,
    clearPendingTransaction,
    retryPendingTransaction,
  };
}
