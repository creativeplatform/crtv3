import { type Hex, type Address } from "viem";
import { serverLogger } from "@/lib/utils/logger";
import { USDS_TOKEN_ADDRESSES } from "@/lib/contracts/USDSToken";
import { GHO_TOKEN_ADDRESSES } from "@/lib/contracts/GHOToken";

// Base chain token addresses
export const BASE_TOKENS = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee", // Native ETH
  USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC on Base
  DAI: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", // DAI on Base
  USDS: USDS_TOKEN_ADDRESSES.base,
  GHO: GHO_TOKEN_ADDRESSES.base,
} as const;

export type TokenSymbol = keyof typeof BASE_TOKENS;

// Token metadata
export const TOKEN_INFO = {
  ETH: { decimals: 18, symbol: "ETH" },
  USDC: { decimals: 6, symbol: "USDC" },
  DAI: { decimals: 18, symbol: "DAI" },
  USDS: { decimals: 18, symbol: "USDS" },
  GHO: { decimals: 18, symbol: "GHO" },
} as const;

/** All tokens available in the wallet swap UI. */
export const SWAP_UI_TOKENS: TokenSymbol[] = ['ETH', 'USDC', 'DAI', 'USDS', 'GHO'];

export function emptyTokenBalances(): Record<TokenSymbol, string> {
  return { ETH: '0', USDC: '0', DAI: '0', USDS: '0', GHO: '0' };
}

export function emptyTokenPrices(): Record<TokenSymbol, number> {
  return { ETH: 0, USDC: 0, DAI: 0, USDS: 0, GHO: 0 };
}

interface SwapQuoteRequest {
  from: Address;
  chainId: string;
  fromToken: Address;
  toToken: Address;
  fromAmount?: Hex;
  minimumToAmount?: Hex;
  capabilities?: {
    paymasterService?: {
      policyId: string;
    };
    erc20?: {
      tokenAddress: string;
    };
  };
  slippage?: Hex;
}

interface SwapQuoteResponse {
  id: number;
  jsonrpc: "2.0";
  result?: {
    quote: {
      minimumToAmount: Hex;
      expiry: Hex;
      fromAmount?: Hex;
    };
    type: string;
    data: any;
    calls?: Array<{
      to: Hex;
      data: Hex;
      value: Hex;
    }>;
    signatureRequest: {
      type: string;
      data: {
        raw: Hex;
      };
      rawPayload: Hex;
    };
    feePayment?: {
      sponsored: boolean;
      tokenAddress: Address;
      maxAmount: Hex;
    };
  };
  error?: {
    code: number;
    message: string;
  };
}

interface SendPreparedCallsRequest {
  type: string;
  data: any;
  chainId: string;
  signature: {
    type: string;
    data: Hex;
  };
}

interface SendPreparedCallsResponse {
  jsonrpc: "2.0";
  id: number;
  result: {
    preparedCallIds: string[];
  };
  error?: {
    code: number;
    message: string;
  };
}

interface CallStatusResponse {
  jsonrpc: "2.0";
  id: number;
  result: {
    id: string;
    chainId: string;
    atomic: boolean;
    status: number;
    receipts?: Array<{
      transactionHash: Hex;
      blockNumber: Hex;
      gasUsed: Hex;
      effectiveGasPrice: Hex;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

export class AlchemySwapService {
  private apiKey: string;
  private paymasterPolicyId?: string;

  constructor(apiKey: string, paymasterPolicyId?: string) {
    this.apiKey = apiKey;
    this.paymasterPolicyId = paymasterPolicyId;
  }

  /**
   * Request a swap quote from Alchemy
   */
  async requestSwapQuote(params: {
    from: Address;
    fromToken: TokenSymbol;
    toToken: TokenSymbol;
    fromAmount?: Hex;
    minimumToAmount?: Hex;
    slippage?: number; // in basis points (e.g., 50 = 0.5%)
    capabilities?: Record<string, any>; // Allow overriding capabilities (e.g. for paymaster)
  }): Promise<SwapQuoteResponse> {
    const { from, fromToken, toToken, fromAmount, minimumToAmount, slippage = 50, capabilities } = params;

    if (!this.apiKey) {
      throw new Error("Alchemy API key is not configured. Please check your environment variables.");
    }

    if (fromToken === toToken) {
      throw new Error("Cannot swap token to itself");
    }

    // Validate that the amount is reasonable (not too small)
    if (fromAmount) {
      const amount = BigInt(fromAmount);
      const minAmount = BigInt(1000); // Minimum 1000 wei equivalent
      if (amount < minAmount) {
        throw new Error(`Amount too small. Minimum amount is ${minAmount} wei.`);
      }
    }



    const quoteRequest: SwapQuoteRequest = {
      from,
      chainId: "0x2105", // Base mainnet chain ID
      fromToken: BASE_TOKENS[fromToken],
      toToken: BASE_TOKENS[toToken],
      capabilities: capabilities !== undefined ? capabilities : (this.paymasterPolicyId ? {
        paymasterService: {
          policyId: this.paymasterPolicyId,
        },
      } : undefined),
      slippage: `0x${slippage.toString(16)}`,
      returnRawCalls: true,
    } as any;

    // Add either fromAmount or minimumToAmount
    if (fromAmount) {
      quoteRequest.fromAmount = fromAmount;
    } else if (minimumToAmount) {
      quoteRequest.minimumToAmount = minimumToAmount;
    } else {
      throw new Error("Either fromAmount or minimumToAmount must be provided");
    }

    serverLogger.debug('Making swap quote request with:', {
      apiKey: this.apiKey ? `${this.apiKey.slice(0, 10)}...` : 'MISSING',
      quoteRequest: {
        ...quoteRequest,
        capabilities: quoteRequest.capabilities ? 'PRESENT' : 'MISSING'
      }
    });

    const response = await fetch(`https://api.g.alchemy.com/v2/${this.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "wallet_requestQuote_v0",
        params: [quoteRequest],
      }),
    });

    if (!response.ok) {
      let errorMessage = `Swap quote request failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = `API Error: ${errorData.error.message || errorData.error}`;
        }
      } catch (jsonError) {
        // Response is not JSON, use the default error message
      }
      throw new Error(errorMessage);
    }

    const result = await response.json() as SwapQuoteResponse;

    serverLogger.debug('Swap quote response:', {
      hasResult: !!result.result,
      hasError: !!result.error,
      error: result.error,
      result: result.result ? 'PRESENT' : 'MISSING'
    });

    if (result.error) {
      serverLogger.error('Swap quote error details:', {
        code: result.error.code,
        message: result.error.message,
        fullError: result.error
      });

      // Provide more specific error messages based on the error type
      let specificMessage = result.error.message;

      if (result.error.message?.includes('Multicall3: call failed')) {
        specificMessage = `Swap failed: Multicall3 call failed. This usually means:
1. The account doesn't have sufficient ${fromToken} balance
2. The smart account isn't properly deployed on Base
3. The account needs ETH for gas fees
4. The token addresses are invalid

Please ensure your account has enough ${fromToken} and ETH for gas fees.

Original error: ${result.error.message}`;
      } else if (result.error.message?.includes('insufficient funds')) {
        specificMessage = `Insufficient balance: You don't have enough ${fromToken} to perform this swap.`;
      } else if (result.error.message?.includes('invalid token')) {
        specificMessage = `Invalid token: The ${fromToken} or ${toToken} token address is not valid on Base network.`;
      } else if (result.error.message?.includes('account not deployed')) {
        specificMessage = `Smart account not deployed: Your smart account needs to be deployed on Base network ` +
          `before you can perform swaps. Try sending a small amount of ETH to your account first.`;
      }

      throw new Error(specificMessage);
    }

    return result;
  }



  /**
   * Send prepared swap calls
   */
  async sendPreparedCalls(params: {
    type: string;
    data: any;
    chainId: string;
    signature: Hex;
  }): Promise<SendPreparedCallsResponse> {
    const { type, data, chainId, signature } = params;

    const requestBody: SendPreparedCallsRequest = {
      type,
      data,
      chainId,
      signature: {
        type: "secp256k1",
        data: signature,
      },
    };

    const response = await fetch(`https://api.g.alchemy.com/v2/${this.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "wallet_sendPreparedCalls",
        params: [requestBody],
      }),
    });

    if (!response.ok) {
      throw new Error(`Send prepared calls failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as SendPreparedCallsResponse;

    if (result.error) {
      throw new Error(`RPC Error: ${result.error.message}`);
    }

    return result;
  }

  /**
   * Get call status
   */
  async getCallStatus(callId: string): Promise<CallStatusResponse> {
    const response = await fetch(`https://api.g.alchemy.com/v2/${this.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "wallet_getCallsStatus",
        params: [[callId]],
      }),
    });

    if (!response.ok) {
      throw new Error(`Get call status failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as CallStatusResponse;

    if (result.error) {
      throw new Error(`RPC Error: ${result.error.message}`);
    }

    return result;
  }

  /**
   * Wait for call completion with polling
   */
  async waitForCallCompletion(callId: string, maxAttempts = 60, intervalMs = 2000): Promise<CallStatusResponse> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.getCallStatus(callId);

      // Status codes: 100 = Pending, 200 = Confirmed, 400 = Offchain Failure, 500 = Onchain Failure
      if (status.result.status === 200) {
        return status; // Success
      } else if (status.result.status >= 400) {
        throw new Error(`Transaction failed with status ${status.result.status}`);
      }

      // Still pending, wait and try again
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Transaction timed out after ${maxAttempts} attempts`);
  }

  /**
   * Convert amount to hex with proper decimals
   */
  static formatAmount(amount: string, token: TokenSymbol): Hex {
    const decimals = TOKEN_INFO[token].decimals;
    const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
    return `0x${amountBigInt.toString(16)}` as Hex;
  }

  /**
   * Convert SDK bigint or hex amount to readable format
   */
  static parseAmount(amount: bigint | Hex | string, token: TokenSymbol): string {
    const decimals = TOKEN_INFO[token].decimals;
    const amountBigInt = typeof amount === "bigint" ? amount : BigInt(amount);
    const human = Number(amountBigInt) / 10 ** decimals;
    return human.toFixed(6);
  }
}

// Export singleton instance
export const alchemySwapService = new AlchemySwapService(
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID
);
