import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { baseMainnet } from '@/lib/utils/chains/base';
import { logger } from '@/lib/utils/logger';

// MeTokenFactory ABI - we only need the MeTokenCreated event
const METOKEN_FACTORY_ABI = parseAbi([
  'event MeTokenCreated(address indexed meToken, address indexed owner, string name, string symbol)'
]);

const METOKEN_FACTORY_ADDRESS = '0xb31Ae2583d983faa7D8C8304e6A16E414e721A0B';

// Create a public client for reading blockchain data
const publicClient = createPublicClient({
  chain: baseMainnet,
  transport: http(undefined, {
    fetchOptions: {
      headers: {
        "Accept-Encoding": "gzip",
      },
    },
  }),
});

/**
 * Get the return value from a transaction (works for successful state-changing calls)
 * @param transactionHash - The transaction hash
 * @returns The decoded return value or null
 */
export async function getTransactionReturnValue(transactionHash: string): Promise<string | null> {
  try {
    const tx = await publicClient.getTransaction({ hash: transactionHash as `0x${string}` });
    const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash as `0x${string}` });

    if (!tx || !receipt || receipt.status !== 'success') {
      return null;
    }

    // Simulate the call at the block it was mined to get the return value
    try {
      const result = await publicClient.call({
        to: tx.to!,
        data: tx.input,
        blockNumber: receipt.blockNumber
      });

      if (result.data && result.data.length === 66) {
        // 0x + 64 chars = address (with leading zeros)
        const address = '0x' + result.data.slice(-40);
        logger.debug('✅ Extracted address from return value:', address);
        return address;
      }
    } catch (error) {
      logger.warn('Could not simulate call:', error);
    }

    return null;
  } catch (error) {
    logger.error('Error getting transaction return value:', error);
    return null;
  }
}

/**
 * Extract the MeToken contract address from a transaction hash
 * @param transactionHash - The hash of the transaction that created the MeToken
 * @returns The MeToken contract address or null if not found
 */
export async function extractMeTokenAddressFromTransaction(transactionHash: string): Promise<string | null> {
  try {
    logger.debug('🔍 Extracting MeToken address from transaction:', transactionHash);

    // First try to get the return value directly
    const returnValue = await getTransactionReturnValue(transactionHash);
    if (returnValue) {
      logger.debug('✅ Found MeToken address from return value:', returnValue);
      return returnValue;
    }

    // Get the transaction receipt
    const receipt = await publicClient.getTransactionReceipt({
      hash: transactionHash as `0x${string}`
    });

    if (!receipt) {
      logger.error('No receipt found for transaction:', transactionHash);
      return null;
    }

    logger.debug('📋 Receipt logs count:', receipt.logs.length);

    // First, check if the transaction created a contract (contractAddress field)
    if (receipt.contractAddress) {
      logger.debug('✅ Found contract address in receipt:', receipt.contractAddress);
      return receipt.contractAddress;
    }

    // For UserOperations and smart account transactions, we need to parse all logs
    // Look for any contract creation events
    if (receipt.logs && receipt.logs.length > 0) {
      logger.debug('🔎 Searching through', receipt.logs.length, 'logs...');

      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        logger.debug(`Log ${i}:`, {
          address: log.address,
          topics: log.topics,
          data: log.data
        });

        // Check if this is a MeTokenCreated event
        // Event signature: MeTokenCreated(address indexed meToken, address indexed owner, string name, string symbol)
        // Keccak256 hash: 0x4f51faf6c4561ff95f067657e43439f0f856d97c04d9ec9070a6199ad418e235
        if (log.topics[0] === '0x4f51faf6c4561ff95f067657e43439f0f856d97c04d9ec9070a6199ad418e235') {
          // The contract address is in the first indexed topic (meToken)
          const meTokenAddress = log.topics[1];
          if (meTokenAddress) {
            // Convert from 32-byte format to 20-byte address format
            const address = '0x' + meTokenAddress.slice(-40);
            logger.debug('✅ Found MeToken address in MeTokenCreated event:', address);
            return address;
          }
        }
      }

      // Also check for generic contract creation patterns
      // Look for logs from the MeTokenFactory contract
      const METOKEN_FACTORY = '0xb31Ae2583d983faa7D8C8304e6A16E414e721A0B';
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === METOKEN_FACTORY.toLowerCase()) {
          logger.debug('📍 Found log from MeTokenFactory:', log);
          // If there's any topic with an address, it might be the deployed contract
          for (let i = 1; i < log.topics.length; i++) {
            const topic = log.topics[i];
            if (topic && topic.length === 66) { // 0x + 64 chars = address in 32 bytes
              const potentialAddress = '0x' + topic.slice(-40);
              logger.debug('🤔 Potential contract address from topic:', potentialAddress);
              // We'll return the first one we find from the factory
              return potentialAddress;
            }
          }
        }
      }
    }

    logger.error('❌ No contract address found in transaction receipt or logs:', transactionHash);
    logger.debug('Full receipt:', JSON.stringify(receipt, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
      , 2));
    return null;
  } catch (error) {
    logger.error('Failed to extract MeToken address from transaction:', error);
    return null;
  }
}

/**
 * Get the most recent MeToken created by an owner
 * @param ownerAddress - The address of the MeToken owner
 * @returns The MeToken address or null if not found
 */
export async function getLatestMeTokenByOwner(ownerAddress: string): Promise<string | null> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.debug(`🔎 Searching for MeTokens created by: ${ownerAddress} (attempt ${attempt + 1}/${maxRetries})`);

      // Get the current block
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock - 10000n; // Search last ~10k blocks (~2 hours on Base)

      logger.debug(`📊 Searching blocks ${fromBlock} to ${currentBlock}`);

      // First, query ALL MeTokenCreated events to see if any were created
      const allLogs = await publicClient.getLogs({
        address: METOKEN_FACTORY_ADDRESS as `0x${string}`,
        event: METOKEN_FACTORY_ABI[0],
        fromBlock,
        toBlock: currentBlock
      });

      logger.debug(`📊 Total MeTokenCreated events in range: ${allLogs.length}`);
      if (allLogs.length > 0) {
        logger.debug('Recent events:', allLogs.slice(-3).map(log => ({
          meToken: log.args.meToken,
          owner: log.args.owner,
          block: log.blockNumber
        })));
      }

      // Query MeTokenCreated events for this specific owner
      const logs = await publicClient.getLogs({
        address: METOKEN_FACTORY_ADDRESS as `0x${string}`,
        event: METOKEN_FACTORY_ABI[0],
        args: {
          owner: ownerAddress as `0x${string}`
        },
        fromBlock,
        toBlock: currentBlock
      });

      logger.debug(`📋 Found ${logs.length} MeToken creation events for owner ${ownerAddress}`);

      if (logs.length > 0) {
        // Get the most recent one
        const latestLog = logs[logs.length - 1];
        const meTokenAddress = latestLog.args.meToken as string;
        logger.debug('✅ Latest MeToken address:', meTokenAddress);
        return meTokenAddress;
      }

      logger.debug('⚠️ No MeTokens found for this owner');
      return null;
    } catch (error) {
      const isAbortError = error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'));

      if (isAbortError && attempt < maxRetries - 1) {
        logger.warn(`⏱️ Request aborted, retrying... (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        continue;
      }

      logger.error('Failed to get latest MeToken:', error);
      return null;
    }
  }

  return null;
}

/**
 * Get MeToken information from the blockchain
 * @param meTokenAddress - The MeToken contract address
 * @returns MeToken information or null if not found
 */
export async function getMeTokenInfoFromBlockchain(meTokenAddress: string): Promise<{
  name: string;
  symbol: string;
  totalSupply: string;
  owner: string;
} | null> {
  try {
    logger.debug('🔍 Getting MeToken info for:', meTokenAddress);

    // ERC20 ABI for basic token info
    const ERC20_ABI = parseAbi([
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function totalSupply() view returns (uint256)'
    ]);

    // Diamond ABI
    const DIAMOND_ADDRESS = '0xba5502db2aC2cBff189965e991C07109B14eB3f5';
    const DIAMOND_ABI = parseAbi([
      'struct MeTokenInfo { address owner; uint256 hubId; uint256 balancePooled; uint256 balanceLocked; uint256 startTime; uint256 endTime; uint256 targetHubId; address migration; }',
      'function getMeTokenInfo(address meToken) view returns (MeTokenInfo)'
    ]);

    // Use multicall to fetch all data in a single RPC request
    const results = await publicClient.multicall({
      contracts: [
        {
          address: meTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'name'
        },
        {
          address: meTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'symbol'
        },
        {
          address: meTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'totalSupply'
        },
        {
          address: DIAMOND_ADDRESS,
          abi: DIAMOND_ABI,
          functionName: 'getMeTokenInfo',
          args: [meTokenAddress as `0x${string}`]
        }
      ]
    });

    const nameResult = results[0];
    const symbolResult = results[1];
    const supplyResult = results[2];
    const infoResult = results[3];

    // Check for critical failures (Diamond info is critical for owner)
    if (infoResult.status !== 'success') {
      logger.error('❌ Failed to get MeToken info from Diamond:', infoResult.error);
      throw new Error('Failed to get MeToken info from Diamond');
    }

    const name = nameResult.status === 'success' ? nameResult.result as string : '';
    const symbol = symbolResult.status === 'success' ? symbolResult.result as string : '';
    const totalSupply = supplyResult.status === 'success' ? (supplyResult.result as bigint).toString() : '0';
    const meTokenInfo = infoResult.result as any;

    logger.debug('✅ Fetched MeToken info:', { name, symbol, totalSupply, owner: meTokenInfo.owner });

    return {
      name,
      symbol,
      totalSupply,
      owner: meTokenInfo.owner
    };
  } catch (error) {
    logger.error('❌ Failed to get MeToken info from blockchain:', error);
    return null;
  }
}

/**
 * Get MeToken protocol information from the diamond contract
 * @param meTokenAddress - The MeToken contract address
 * @returns MeToken protocol information or null if not found
 */
export async function getMeTokenProtocolInfo(meTokenAddress: string): Promise<{
  hubId: number;
  balancePooled: string;
  balanceLocked: string;
  startTime: number;
  endTime: number;
  endCooldown: number;
  targetHubId: number;
  migration: string;
} | null> {
  try {
    // Diamond contract ABI for MeToken protocol info
    // Returns a struct: (address owner, uint256 hubId, uint256 balancePooled, uint256 balanceLocked, uint256 startTime, uint256 endTime, uint256 targetHubId, address migration)
    const DIAMOND_ABI = parseAbi([
      'struct MeTokenInfo { address owner; uint256 hubId; uint256 balancePooled; uint256 balanceLocked; uint256 startTime; uint256 endTime; uint256 targetHubId; address migration; }',
      'function getMeTokenInfo(address meToken) view returns (MeTokenInfo)'
    ]);

    const DIAMOND_ADDRESS = '0xba5502db2aC2cBff189965e991C07109B14eB3f5'; // Base mainnet diamond

    const result = await publicClient.readContract({
      address: DIAMOND_ADDRESS,
      abi: DIAMOND_ABI,
      functionName: 'getMeTokenInfo',
      args: [meTokenAddress as `0x${string}`]
    });

    const info = result as any;

    return {
      hubId: Number(info.hubId),
      balancePooled: info.balancePooled.toString(),
      balanceLocked: info.balanceLocked.toString(),
      startTime: Number(info.startTime),
      endTime: Number(info.endTime),
      endCooldown: 0, // Not available in this view
      targetHubId: Number(info.targetHubId),
      migration: info.migration
    };
  } catch (error) {
    logger.error('Failed to get MeToken protocol info:', error);
    return null;
  }
}

/**
 * Get MeToken information for multiple tokens in a single RPC call (multicall)
 * This significantly reduces RPC usage compared to calling getMeTokenInfoFromBlockchain individually
 * @param meTokenAddresses - Array of MeToken contract addresses
 * @returns Map of address -> combined token info
 */
export async function getBulkMeTokenInfo(meTokenAddresses: string[]): Promise<Record<string, {
  totalSupply: string;
  owner: string;
  tvl: number;
  price: number;
} | null>> {
  if (meTokenAddresses.length === 0) return {};

  try {
    logger.debug(`📦 Bulk fetching info for ${meTokenAddresses.length} MeTokens...`);

    // ERC20 ABI for basic token info
    const ERC20_ABI = parseAbi([
      'function totalSupply() view returns (uint256)'
    ]);

    // Diamond ABI
    const DIAMOND_ADDRESS = '0xba5502db2aC2cBff189965e991C07109B14eB3f5';
    const DIAMOND_ABI = parseAbi([
      'struct MeTokenInfo { address owner; uint256 hubId; uint256 balancePooled; uint256 balanceLocked; uint256 startTime; uint256 endTime; uint256 targetHubId; address migration; }',
      'function getMeTokenInfo(address meToken) view returns (MeTokenInfo)'
    ]);

    // Construct all calls into a single array
    const calls = [];

    // Add totalSupply calls
    for (const address of meTokenAddresses) {
      calls.push({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'totalSupply'
      });
    }

    // Add Diamond info calls
    for (const address of meTokenAddresses) {
      calls.push({
        address: DIAMOND_ADDRESS as `0x${string}`,
        abi: DIAMOND_ABI,
        functionName: 'getMeTokenInfo',
        args: [address as `0x${string}`]
      });
    }

    // Execute single multicall
    const results = await publicClient.multicall({ contracts: calls });

    const parsedResults: Record<string, any> = {};
    const count = meTokenAddresses.length;

    // Process results
    for (let i = 0; i < count; i++) {
      const address = meTokenAddresses[i];
      // results[i] is totalSupply, results[i + count] is diamond info
      const supplyResult = results[i] as { status: string, result: any };
      const diamondResult = results[i + count] as { status: string, result: any };

      if (supplyResult.status === 'success' && diamondResult.status === 'success') {
        const totalSupply = supplyResult.result as bigint;
        const info = diamondResult.result as any;

        const balancePooled = BigInt(info.balancePooled || 0);
        const balanceLocked = BigInt(info.balanceLocked || 0);
        const totalBalance = balancePooled + balanceLocked;

        const tvl = parseFloat(formatEther(totalBalance));
        const supplyLog = parseFloat(formatEther(totalSupply));
        const price = supplyLog > 0 ? tvl / supplyLog : 0;

        parsedResults[address] = {
          totalSupply: totalSupply.toString(),
          owner: info.owner,
          tvl,
          price
        };
      }
    }

    return parsedResults;
  } catch (err) {
    logger.error('❌ Failed to bulk fetch MeToken info:', err);
    return {};
  }
}
