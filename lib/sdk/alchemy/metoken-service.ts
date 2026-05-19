import { Alchemy, Network, Utils } from "alchemy-sdk";
import { createPublicClient, createWalletClient, http, parseEther, formatEther, encodeFunctionData } from "viem";
import { baseMainnet } from "@/lib/utils/chains/base";
import { privateKeyToAccount } from "viem/accounts";
import { serverLogger } from "@/lib/utils/logger";

// Alchemy SDK configuration
const alchemyConfig = {
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!,
  network: Network.BASE_MAINNET,
};

export const alchemy = new Alchemy(alchemyConfig);

// Contract addresses for Base mainnet
export const METOKEN_CONTRACTS = {
  DIAMOND: '0xba5502db2aC2cBff189965e991C07109B14eB3f5' as const,
  FACTORY: '0xb31Ae2583d983faa7D8C8304e6A16E414e721A0B' as const,
  DAI: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' as const,
} as const;

// Diamond contract ABI for metoken operations
export const DIAMOND_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "symbol", "type": "string"},
      {"internalType": "uint256", "name": "hubId", "type": "uint256"},
      {"internalType": "uint256", "name": "assetsDeposited", "type": "uint256"}
    ],
    "name": "subscribe",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "meToken", "type": "address"}
    ],
    "name": "getMeTokenInfo",
    "outputs": [
      {
        "components": [
          {"internalType": "address", "name": "owner", "type": "address"},
          {"internalType": "uint256", "name": "hubId", "type": "uint256"},
          {"internalType": "uint256", "name": "balancePooled", "type": "uint256"},
          {"internalType": "uint256", "name": "balanceLocked", "type": "uint256"},
          {"internalType": "uint256", "name": "startTime", "type": "uint256"},
          {"internalType": "uint256", "name": "endTime", "type": "uint256"},
          {"internalType": "uint256", "name": "targetHubId", "type": "uint256"},
          {"internalType": "address", "name": "migration", "type": "address"}
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
      {"internalType": "address", "name": "meToken", "type": "address"},
      {"internalType": "uint256", "name": "assetsDeposited", "type": "uint256"},
      {"internalType": "address", "name": "recipient", "type": "address"}
    ],
    "name": "mint",
    "outputs": [
      {"internalType": "uint256", "name": "meTokensMinted", "type": "uint256"}
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// Factory contract ABI
export const FACTORY_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "symbol", "type": "string"},
      {"internalType": "address", "name": "diamond", "type": "address"}
    ],
    "name": "create",
    "outputs": [
      {"internalType": "address", "name": "", "type": "address"}
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// ERC20 ABI for DAI
export const ERC20_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [
      {"internalType": "bool", "name": "", "type": "bool"}
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "account", "type": "address"}
    ],
    "name": "balanceOf",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface MeTokenCreationParams {
  name: string;
  symbol: string;
  hubId: number;
  assetsDeposited: string; // In DAI (as string to avoid precision issues)
  creatorAddress: string;
}

export interface MeTokenCreationResult {
  meTokenAddress: string;
  transactionHash: string;
  meTokensMinted: string;
  hubId: number;
  assetsDeposited: string;
}

export interface MeTokenInfo {
  owner: string;
  hubId: number;
  balancePooled: string;
  balanceLocked: string;
  startTime: number;
  endTime: number;
  targetHubId: number;
  migration: string;
}

export class AlchemyMeTokenService {
  private alchemy: Alchemy;
  private publicClient: any;
  private walletClient: any;

  constructor() {
    this.alchemy = alchemy;
    
    // Create Viem clients for blockchain interactions
    this.publicClient = createPublicClient({
      chain: baseMainnet,
      transport: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`, {
        fetchOptions: {
          headers: {
            "Accept-Encoding": "gzip",
          },
        },
      }),
    });

    // Note: For production, you should use a secure way to handle private keys
    // This is just for demonstration - in real implementation, use Account Kit or secure key management
    if (process.env.ALCHEMY_SWAP_PRIVATE_KEY) {
      const account = privateKeyToAccount(process.env.ALCHEMY_SWAP_PRIVATE_KEY as `0x${string}`);
      this.walletClient = createWalletClient({
        account,
        chain: baseMainnet,
        transport: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`, {
          fetchOptions: {
            headers: {
              "Accept-Encoding": "gzip",
            },
          },
        }),
      });
    }
  }

  /**
   * Create a new MeToken using the Alchemy SDK and Diamond contract
   * This is the main function that orchestrates the entire metoken creation process
   */
  async createMeToken(params: MeTokenCreationParams): Promise<MeTokenCreationResult> {
    try {
      serverLogger.debug('🚀 Starting MeToken creation with Alchemy SDK:', params);

      // Step 1: Validate inputs
      this.validateCreationParams(params);

      // Step 2: Check DAI balance and allowance
      await this.validateDaiBalance(params.creatorAddress, params.assetsDeposited);

      // Step 3: Create the MeToken using the subscribe function
      const result = await this.executeMeTokenCreation(params);

      serverLogger.debug('✅ MeToken creation completed:', result);
      return result;

    } catch (error) {
      serverLogger.error('❌ MeToken creation failed:', error);
      throw new Error(`Failed to create MeToken: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get MeToken information from the blockchain
   */
  async getMeTokenInfo(meTokenAddress: string): Promise<MeTokenInfo | null> {
    try {
      const result = await this.publicClient.readContract({
        address: METOKEN_CONTRACTS.DIAMOND,
        abi: DIAMOND_ABI,
        functionName: 'getMeTokenInfo',
        args: [meTokenAddress as `0x${string}`],
      });

      return {
        owner: result[0],
        hubId: Number(result[1]),
        balancePooled: result[2].toString(),
        balanceLocked: result[3].toString(),
        startTime: Number(result[4]),
        endTime: Number(result[5]),
        targetHubId: Number(result[6]),
        migration: result[7],
      };
    } catch (error) {
      serverLogger.error('Failed to get MeToken info:', error);
      return null;
    }
  }

  /**
   * Check if a MeToken is subscribed to a hub
   */
  async isMeTokenSubscribed(meTokenAddress: string): Promise<boolean> {
    const info = await this.getMeTokenInfo(meTokenAddress);
    return info ? info.balancePooled !== '0' || info.balanceLocked !== '0' : false;
  }

  /**
   * Get DAI balance for an address
   */
  async getDaiBalance(address: string): Promise<string> {
    try {
      const balance = await this.publicClient.readContract({
        address: METOKEN_CONTRACTS.DAI,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });

      return formatEther(balance as bigint);
    } catch (error) {
      serverLogger.error('Failed to get DAI balance:', error);
      return '0';
    }
  }

  /**
   * Get DAI allowance for the Diamond contract
   */
  async getDaiAllowance(owner: string, spender: string = METOKEN_CONTRACTS.DIAMOND): Promise<string> {
    try {
      const allowance = await this.publicClient.readContract({
        address: METOKEN_CONTRACTS.DAI,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner as `0x${string}`, spender as `0x${string}`],
      });

      return formatEther(allowance as bigint);
    } catch (error) {
      serverLogger.error('Failed to get DAI allowance:', error);
      return '0';
    }
  }

  /**
   * Estimate gas for MeToken creation
   */
  async estimateMeTokenCreationGas(params: MeTokenCreationParams): Promise<bigint> {
    try {
      const assetsDepositedWei = parseEther(params.assetsDeposited);
      
      const gasEstimate = await this.publicClient.estimateContractGas({
        address: METOKEN_CONTRACTS.DIAMOND,
        abi: DIAMOND_ABI,
        functionName: 'subscribe',
        args: [params.name, params.symbol, BigInt(params.hubId), assetsDepositedWei],
        account: params.creatorAddress as `0x${string}`,
      });

      return gasEstimate;
    } catch (error) {
      serverLogger.error('Failed to estimate gas:', error);
      throw new Error('Failed to estimate gas for MeToken creation');
    }
  }

  /**
   * Get current gas prices using Alchemy
   */
  async getGasPrices(): Promise<{
    slow: string;
    standard: string;
    fast: string;
  }> {
    try {
      const feeData = await this.alchemy.core.getFeeData();
      
      return {
        slow: formatEther(feeData.gasPrice ? BigInt(feeData.gasPrice.toString()) : BigInt(0)),
        standard: formatEther(feeData.gasPrice ? BigInt(feeData.gasPrice.toString()) : BigInt(0)),
        fast: formatEther(feeData.maxFeePerGas ? BigInt(feeData.maxFeePerGas.toString()) : BigInt(0)),
      };
    } catch (error) {
      serverLogger.error('Failed to get gas prices:', error);
      return {
        slow: '0',
        standard: '0',
        fast: '0',
      };
    }
  }

  // Private helper methods

  private validateCreationParams(params: MeTokenCreationParams): void {
    if (!params.name || params.name.trim().length === 0) {
      throw new Error('MeToken name is required');
    }
    if (!params.symbol || params.symbol.trim().length === 0) {
      throw new Error('MeToken symbol is required');
    }
    if (params.hubId <= 0) {
      throw new Error('Hub ID must be greater than 0');
    }
    if (!params.assetsDeposited || parseFloat(params.assetsDeposited) <= 0) {
      throw new Error('Assets deposited must be greater than 0');
    }
    if (!params.creatorAddress) {
      throw new Error('Creator address is required');
    }
  }

  private async validateDaiBalance(address: string, amount: string): Promise<void> {
    const balance = await this.getDaiBalance(address);
    const requiredAmount = parseFloat(amount);
    const currentBalance = parseFloat(balance);

    if (currentBalance < requiredAmount) {
      throw new Error(`Insufficient DAI balance. Required: ${amount} DAI, Available: ${balance} DAI`);
    }
  }

  private async executeMeTokenCreation(params: MeTokenCreationParams): Promise<MeTokenCreationResult> {
    if (!this.walletClient) {
      throw new Error('Wallet client not configured. This function requires a private key for transaction execution.');
    }

    const assetsDepositedWei = parseEther(params.assetsDeposited);

    // Step 1: Check and approve DAI if needed
    await this.ensureDaiAllowance(params.creatorAddress, assetsDepositedWei);

    // Step 2: Execute the subscribe function to create the MeToken
    const hash = await this.walletClient.writeContract({
      address: METOKEN_CONTRACTS.DIAMOND,
      abi: DIAMOND_ABI,
      functionName: 'subscribe',
      args: [params.name, params.symbol, BigInt(params.hubId), assetsDepositedWei],
      account: params.creatorAddress as `0x${string}`,
    });

    // Step 3: Wait for transaction confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Step 4: Extract MeToken address from transaction logs
    const meTokenAddress = this.extractMeTokenAddressFromLogs(receipt.logs);

    if (!meTokenAddress) {
      throw new Error('Failed to extract MeToken address from transaction logs');
    }

    // Step 5: Get the created MeToken info
    const meTokenInfo = await this.getMeTokenInfo(meTokenAddress);
    if (!meTokenInfo) {
      throw new Error('Failed to retrieve MeToken information after creation');
    }

    return {
      meTokenAddress,
      transactionHash: hash,
      meTokensMinted: formatEther(BigInt(meTokenInfo.balancePooled)),
      hubId: params.hubId,
      assetsDeposited: params.assetsDeposited,
    };
  }

  private async ensureDaiAllowance(owner: string, amount: bigint): Promise<void> {
    const currentAllowance = await this.getDaiAllowance(owner);
    const currentAllowanceWei = parseEther(currentAllowance);

    if (currentAllowanceWei < amount) {
      serverLogger.debug('🔓 Approving DAI for MeToken creation...');
      
      const approveHash = await this.walletClient.writeContract({
        address: METOKEN_CONTRACTS.DAI,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [METOKEN_CONTRACTS.DIAMOND, amount],
        account: owner as `0x${string}`,
      });

      await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
      serverLogger.debug('✅ DAI approved successfully');
    }
  }

  private extractMeTokenAddressFromLogs(logs: any[]): string | null {
    // Look for the Subscribe event in the transaction logs
    // The Subscribe event contains the MeToken address
    for (const log of logs) {
      if (log.address.toLowerCase() === METOKEN_CONTRACTS.DIAMOND.toLowerCase()) {
        // Parse the log to extract the MeToken address
        // This is a simplified version - in production, you'd want to properly decode the event
        try {
          // The Subscribe event has the MeToken address as the first indexed parameter
          if (log.topics && log.topics.length > 0) {
            // The MeToken address is in the first topic (indexed parameter)
            const meTokenAddress = '0x' + log.topics[1].slice(26); // Remove the 0x and first 24 characters
            return meTokenAddress;
          }
        } catch (error) {
          serverLogger.error('Failed to parse MeToken address from log:', error);
        }
      }
    }
    return null;
  }
}

// Export singleton instance (lazy-loaded to avoid build-time initialization errors)
let _alchemyMeTokenServiceInstance: AlchemyMeTokenService | null = null;
export const alchemyMeTokenService = {
  get instance(): AlchemyMeTokenService {
    if (!_alchemyMeTokenServiceInstance) {
      _alchemyMeTokenServiceInstance = new AlchemyMeTokenService();
    }
    return _alchemyMeTokenServiceInstance;
  }
} as { instance: AlchemyMeTokenService };
