import "dotenv/config";
import { type Address, type Hex } from "viem";
import { LocalAccountSigner } from "@aa-sdk/core";
import { alchemy, base } from "@account-kit/infra";
import { createSmartWalletClient } from "@account-kit/wallet-client";
import { serverLogger } from "@/lib/utils/logger";
import { appendBuilderCode } from "@/lib/utils/builder-code";

export const config = {
  policyId: process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID!,
};

// Client params will be created dynamically to avoid build-time errors
function getClientParams() {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const privateKey = process.env.ALCHEMY_SWAP_PRIVATE_KEY;
  
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_ALCHEMY_API_KEY is not configured');
  }
  
  if (!privateKey) {
    throw new Error('ALCHEMY_SWAP_PRIVATE_KEY is not configured');
  }
  
  return {
    transport: alchemy({
      apiKey,
    }),
    chain: base, // Using Base mainnet instead of Sepolia
    signer: LocalAccountSigner.privateKeyToAccountSigner(
      privateKey as Hex,
    ),
  };
}

let clientWithoutAccount: any = null;
let account: any = null;
let client: any = null;

/**
 * Initialize the swap client
 * This should be called once when the service starts
 */
export async function initializeSwapClient() {
  if (client) return client;

  try {
    const clientParams = getClientParams();
    serverLogger.debug('Initializing swap client with params:', {
      hasApiKey: !!clientParams.transport,
      hasPrivateKey: !!clientParams.signer,
      chainId: clientParams.chain.id,
    });
    
    clientWithoutAccount = createSmartWalletClient(clientParams);
    serverLogger.debug('Created client without account');
    
    account = await clientWithoutAccount.requestAccount();
    serverLogger.debug('Requested account:', account.address);
    
    client = createSmartWalletClient({
      ...clientParams,
      account: account.address,
    });

    serverLogger.debug("Swap client initialized with account:", account.address);
    return client;
  } catch (error) {
    serverLogger.error("Failed to initialize swap client:", error);
    try {
      const clientParams = getClientParams();
      serverLogger.error("Client params:", {
        transport: !!clientParams.transport,
        chain: clientParams.chain.name,
        hasSigner: !!clientParams.signer,
      });
    } catch (paramError) {
      serverLogger.error("Failed to get client params:", paramError);
    }
    throw error;
  }
}

/**
 * Get the initialized swap client
 */
export async function getSwapClient() {
  if (!client) {
    await initializeSwapClient();
  }
  return client;
}

/**
 * Get the account address
 */
export async function getSwapAccountAddress(): Promise<Address> {
  if (!account) {
    await initializeSwapClient();
  }
  return account.address;
}

/**
 * Execute a swap using the backend client
 */
export async function executeSwap(params: {
  fromToken: string;
  toToken: string;
  fromAmount: Hex;
  minimumToAmount?: Hex;
}) {
  serverLogger.debug('Starting swap execution with params:', params);
  
  try {
    // Check environment variables first
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    const policyId = process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID;
    const privateKey = process.env.ALCHEMY_SWAP_PRIVATE_KEY;
    
    serverLogger.debug('Environment variables check:', {
      hasApiKey: !!apiKey,
      hasPolicyId: !!policyId,
      hasPrivateKey: !!privateKey,
    });
    
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_ALCHEMY_API_KEY is not set');
    }
    
    if (!policyId) {
      throw new Error('NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID is not set');
    }
    
    if (!privateKey) {
      throw new Error('ALCHEMY_SWAP_PRIVATE_KEY is not set');
    }
    
    // Initialize swap client
    const swapClient = await getSwapClient();
    const accountAddress = await getSwapAccountAddress();
    
    serverLogger.debug('Swap client and account initialized:', { 
      hasClient: !!swapClient, 
      accountAddress 
    });
    
    // Request quote from Alchemy
    const quoteRequest = {
      method: "wallet_requestQuote_v0" as const,
      params: [
        {
          from: accountAddress,
          chainId: "0x2105", // Base mainnet
          fromToken: params.fromToken,
          toToken: params.toToken,
          fromAmount: params.fromAmount,
          minimumToAmount: params.minimumToAmount,
          capabilities: {
            paymasterService: {
              policyId: config.policyId,
            },
          },
        },
      ],
    };

    serverLogger.debug('Requesting quote from Alchemy...');
    
    const response = await fetch(
      `https://api.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Encoding": "gzip",
        },
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          ...quoteRequest,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      serverLogger.error('Quote request failed:', response.status, errorText);
      throw new Error(`Quote request failed: ${response.status} - ${errorText}`);
    }

    const quoteResponse = await response.json();
    serverLogger.debug('Quote response received');
    
    if (quoteResponse.error) {
      throw new Error(`RPC Error: ${quoteResponse.error.message}`);
    }

    if (!quoteResponse.result) {
      throw new Error('No quote result received from Alchemy');
    }

    const quote = quoteResponse.result;
    
    // Execute swap using the quote data
    // Handle both new format (with calls array) and legacy format
    const calls = (quote as any).calls;
    let txHash: Hex | null = null;

    if (calls && Array.isArray(calls) && calls.length > 0) {
      // New format: execute calls sequentially
      serverLogger.debug(`Found ${calls.length} prepared calls from quote`);
      
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        const isLast = i === calls.length - 1;
        
        serverLogger.debug(`Executing call ${i + 1}/${calls.length}`, {
          target: call.to,
          value: call.value,
          dataLength: call.data?.length || 0
        });

        const operation = await swapClient.sendUserOperation({
          uo: {
            target: call.to as Address,
            data: appendBuilderCode(call.data as Hex),
            value: BigInt(call.value || '0x0'),
          },
        });

        serverLogger.debug(`UserOperation sent, hash: ${operation.hash}`);

        // Wait for transaction receipt
        const receipt = await swapClient.waitForUserOperationTransaction({
          hash: operation.hash,
        });

        serverLogger.debug(`Transaction confirmed, hash: ${receipt}`);

        if (isLast) {
          txHash = receipt as Hex;
        }
      }
    } else {
      // Legacy format: use quote.data structure
      serverLogger.debug('Using legacy quote format');
      
      const quoteData = (quote as any).data;
      if (!quoteData) {
        throw new Error('Invalid quote format: missing data or calls');
      }

      const target = (quoteData.target || quoteData.sender || accountAddress) as Address;
      const callData = quoteData.callData as Hex;
      const value = BigInt(quoteData.value || '0x0');

      serverLogger.debug('Executing swap with legacy format', {
        target,
        value: value.toString(),
        dataLength: callData.length
      });

      const operation = await swapClient.sendUserOperation({
        uo: {
          target,
          data: appendBuilderCode(callData),
          value,
        },
      });

      serverLogger.debug(`UserOperation sent, hash: ${operation.hash}`);

      txHash = await swapClient.waitForUserOperationTransaction({
        hash: operation.hash,
      }) as Hex;

      serverLogger.debug(`Transaction confirmed, hash: ${txHash}`);
    }

    if (!txHash) {
      throw new Error('Failed to get transaction hash from swap execution');
    }

    return {
      transactionHash: txHash,
      success: true,
      message: "Swap executed successfully."
    };

  } catch (error) {
    serverLogger.error('Swap execution failed:', error);
    throw error;
  }
}
