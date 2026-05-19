/**
 * Transaction Polling Utilities
 * 
 * Provides robust transaction status checking and polling for EIP-4337 UserOperations
 * that may time out on the standard waitForUserOperationTransaction call.
 */

import { createPublicClient, http, decodeEventLog, Log, TransactionReceipt } from 'viem';
import { baseMainnet } from '@/lib/utils/chains/base';
import { logger } from '@/lib/utils/logger';


// Base RPC endpoints with fallbacks
const RPC_ENDPOINTS = [
  `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  'https://mainnet.base.org',
  'https://base.publicnode.com',
];

// UserOperation event ABI for parsing bundler receipts
const USER_OPERATION_EVENT_ABI = [{
  anonymous: false,
  inputs: [
    { indexed: true, internalType: 'bytes32', name: 'userOpHash', type: 'bytes32' },
    { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
    { indexed: true, internalType: 'address', name: 'paymaster', type: 'address' },
    { indexed: false, internalType: 'uint256', name: 'nonce', type: 'uint256' },
    { indexed: false, internalType: 'bool', name: 'success', type: 'bool' },
    { indexed: false, internalType: 'uint256', name: 'actualGasCost', type: 'uint256' },
    { indexed: false, internalType: 'uint256', name: 'actualGasUsed', type: 'uint256' }
  ],
  name: 'UserOperationEvent',
  type: 'event'
}] as const;

// EntryPoint addresses
const ENTRY_POINTS = {
  V06: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  V07: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
};

export interface UserOperationStatus {
  found: boolean;
  success?: boolean;
  txHash?: string;
  blockNumber?: bigint;
  actualGasCost?: bigint;
  actualGasUsed?: bigint;
  error?: string;
}

/**
 * Create a public client with the first working RPC endpoint
 */
async function getPublicClient() {
  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const client = createPublicClient({
        chain: baseMainnet,
        transport: http(rpcUrl),
      });
      
      // Quick test to ensure the RPC is responsive
      await client.getBlockNumber();
      return client;
    } catch (err) {
      logger.warn(`RPC endpoint failed: ${rpcUrl}`, err);
    }
  }
  throw new Error('All RPC endpoints failed');
}

/**
 * Poll for UserOperation receipt by querying EntryPoint event logs
 * 
 * This is a fallback for when waitForUserOperationTransaction times out.
 * It searches for the UserOperationEvent in recent blocks.
 */
export async function pollUserOperationReceipt(
  userOpHash: string,
  options: {
    maxBlocksBack?: number;
    pollInterval?: number;
    maxAttempts?: number;
  } = {}
): Promise<UserOperationStatus> {
  const {
    maxBlocksBack = 1000, // About 30 minutes of blocks on Base
    pollInterval = 5000,   // 5 seconds between polls
    maxAttempts = 60,      // 5 minutes of polling
  } = options;

  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    logger.debug(`🔍 Polling for UserOperation (attempt ${attempts}/${maxAttempts})...`);
    
    try {
      const client = await getPublicClient();
      const currentBlock = await client.getBlockNumber();
      const fromBlock = currentBlock - BigInt(maxBlocksBack);
      
      // Query both EntryPoint versions
      for (const [version, address] of Object.entries(ENTRY_POINTS)) {
        try {
          const logs = await client.getLogs({
            address: address as `0x${string}`,
            event: {
              type: 'event',
              name: 'UserOperationEvent',
              inputs: USER_OPERATION_EVENT_ABI[0].inputs,
            },
            args: {
              userOpHash: userOpHash as `0x${string}`,
            },
            fromBlock,
            toBlock: currentBlock,
          });

          if (logs.length > 0) {
            const log = logs[0];
            const decoded = decodeEventLog({
              abi: USER_OPERATION_EVENT_ABI,
              data: log.data,
              topics: log.topics,
            });

            logger.debug(`✅ Found UserOperation in ${version} EntryPoint:`, {
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              success: (decoded.args as any).success,
            });

            return {
              found: true,
              success: (decoded.args as any).success,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              actualGasCost: (decoded.args as any).actualGasCost,
              actualGasUsed: (decoded.args as any).actualGasUsed,
            };
          }
        } catch (err) {
          logger.warn(`Failed to query ${version} EntryPoint:`, err);
        }
      }
    } catch (err) {
      logger.error('Polling error:', err);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    found: false,
    error: `UserOperation not found after ${maxAttempts} polling attempts`,
  };
}

/**
 * Get transaction receipt with retries
 */
export async function getTransactionReceiptWithRetry(
  txHash: string,
  maxAttempts: number = 10
): Promise<TransactionReceipt | null> {
  const client = await getPublicClient();
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await client.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
      return receipt;
    } catch (err) {
      logger.warn(`Failed to get receipt (attempt ${i + 1}/${maxAttempts}):`, err);
      await new Promise(resolve => setTimeout(resolve, 2000 + i * 1000));
    }
  }
  
  return null;
}

/**
 * Parse Subscribe event from transaction logs to extract MeToken address
 */
export function parseMeTokenAddressFromLogs(logs: Log[]): string | null {
  for (const log of logs) {
    try {
      // The Subscribe event has meToken as the first indexed parameter
      // Topics: [eventSig, meToken, owner]
      if (log.topics.length >= 2) {
        // Check if this might be a Subscribe event by looking at data length
        // Subscribe event has specific data format with minted, asset, assetsDeposited, name, symbol, hubId
        if (log.data && log.data.length > 130) { // Minimum expected length
          // The meToken address is in the first indexed topic after event signature
          const meTokenTopic = log.topics[1];
          if (meTokenTopic && meTokenTopic.length === 66) { // 0x + 64 hex chars
            // Convert topic to address (last 40 chars)
            const possibleAddress = '0x' + meTokenTopic.slice(26);
            
            // Basic validation - check if it looks like an address
            if (possibleAddress.length === 42) {
              logger.debug('📍 Possible MeToken address from logs:', possibleAddress);
              return possibleAddress;
            }
          }
        }
      }
    } catch (err) {
      // Continue to next log
    }
  }
  
  return null;
}

/**
 * Combined function: Wait for UserOperation with polling fallback
 * 
 * Attempts the standard wait first, then falls back to log polling
 */
export async function waitForUserOperationWithFallback(
  userOpHash: string,
  waitFn: (params: { hash: string }) => Promise<string>,
  options: {
    waitTimeout?: number;
    pollMaxAttempts?: number;
  } = {}
): Promise<{
  txHash: string | null;
  status: UserOperationStatus;
}> {
  const {
    waitTimeout = 120000, // 2 minutes
    pollMaxAttempts = 60,  // 5 minutes of polling
  } = options;

  // First try the standard wait with timeout
  try {
    const waitPromise = waitFn({ hash: userOpHash });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Wait timeout')), waitTimeout);
    });

    const txHash = await Promise.race([waitPromise, timeoutPromise]);
    
    return {
      txHash,
      status: {
        found: true,
        success: true,
        txHash,
      },
    };
  } catch (waitError) {
    logger.debug('⏰ Standard wait timed out, falling back to polling...');
  }

  // Fallback to polling
  const status = await pollUserOperationReceipt(userOpHash, {
    maxAttempts: pollMaxAttempts,
  });

  return {
    txHash: status.txHash || null,
    status,
  };
}

/**
 * Check if an address has received a MeToken recently
 * by checking ownership of recently created MeTokens
 */
export async function findRecentMeTokenForAddress(
  ownerAddress: string,
  diamondAddress: string,
  maxMeTokensToCheck: number = 50
): Promise<string | null> {
  try {
    // Import subgraph dynamically to avoid circular deps
    const { meTokensSubgraph } = await import('@/lib/sdk/metokens/subgraph');
    const client = await getPublicClient();
    
    const allMeTokens = await meTokensSubgraph.getAllMeTokens(maxMeTokensToCheck, 0);
    
    for (const meToken of allMeTokens) {
      try {
        const info = await client.readContract({
          address: diamondAddress as `0x${string}`,
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
        
        if (info.owner.toLowerCase() === ownerAddress.toLowerCase()) {
          logger.debug('✅ Found MeToken for address:', meToken.id);
          return meToken.id;
        }
      } catch (err) {
        // Continue checking
      }
    }
    
    return null;
  } catch (err) {
    logger.error('Error finding MeToken for address:', err);
    return null;
  }
}
