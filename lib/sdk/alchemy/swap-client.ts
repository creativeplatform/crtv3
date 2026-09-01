import "dotenv/config";
import { type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  createSmartWalletClient,
  alchemyWalletTransport,
} from "@alchemy/wallet-apis";
import { serverLogger } from "@/lib/utils/logger";
import { appendBuilderCode } from "@/lib/utils/builder-code";

export const config = {
  policyId: process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID!,
};

function getClientParams() {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const privateKey = process.env.ALCHEMY_SWAP_PRIVATE_KEY;

  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_ALCHEMY_API_KEY is not configured");
  }

  if (!privateKey) {
    throw new Error("ALCHEMY_SWAP_PRIVATE_KEY is not configured");
  }

  return {
    transport: alchemyWalletTransport({ apiKey }),
    chain: base,
    signer: privateKeyToAccount(privateKey as Hex),
    paymaster: {
      policyId: process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID!,
    },
  };
}

type SwapWalletClient = {
  sendCalls: (args: {
    account: Address;
    calls: Array<{ to: Address; data: Hex; value: bigint }>;
  }) => Promise<{ id: string }>;
  waitForCallsStatus: (args: { id: string }) => Promise<{
    status?: string;
    receipts?: Array<{ transactionHash?: string }>;
  }>;
  requestAccount: (args: {
    creationHint: { accountType: "sma-b" };
  }) => Promise<{ address: Address }>;
};

let account: { address: Address } | null = null;
let client: SwapWalletClient | null = null;

export async function initializeSwapClient() {
  if (client && account) return client;

  try {
    const clientParams = getClientParams();
    const clientWithoutAccount = createSmartWalletClient(clientParams as never);
    account = await clientWithoutAccount.requestAccount({
      creationHint: { accountType: "sma-b" },
    });

    client = createSmartWalletClient({
      ...clientParams,
      account: account.address,
    } as never) as SwapWalletClient;

    serverLogger.debug("Swap client initialized with account:", account.address);
    return client;
  } catch (error) {
    serverLogger.error("Failed to initialize swap client:", error);
    throw error;
  }
}

export async function getSwapClient() {
  if (!client) {
    await initializeSwapClient();
  }
  return client!;
}

export async function getSwapAccountAddress(): Promise<Address> {
  if (!account) {
    await initializeSwapClient();
  }
  return account!.address;
}

export async function executeSwap(params: {
  fromToken: string;
  toToken: string;
  fromAmount: Hex;
  minimumToAmount?: Hex;
}) {
  serverLogger.debug("Starting swap execution with params:", params);

  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const policyId = process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID;
  const privateKey = process.env.ALCHEMY_SWAP_PRIVATE_KEY;

  if (!apiKey || !policyId || !privateKey) {
    throw new Error("Swap environment variables are not fully configured");
  }

  const swapClient = await getSwapClient();
  const accountAddress = await getSwapAccountAddress();

  const quoteRequest = {
    method: "wallet_requestQuote_v0" as const,
    params: [
      {
        from: accountAddress,
        chainId: "0x2105",
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        minimumToAmount: params.minimumToAmount,
        capabilities: {
          paymaster: {
            policyId: config.policyId,
          },
        },
      },
    ],
  };

  const response = await fetch(`https://api.g.alchemy.com/v2/${apiKey}`, {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Quote request failed: ${response.status} - ${errorText}`);
  }

  const quoteResponse = (await response.json()) as Record<string, unknown> | null;
  if (!quoteResponse || typeof quoteResponse !== "object") {
    throw new Error("Invalid JSON response from Alchemy quote API");
  }
  const rpcError = quoteResponse.error as { message?: string } | undefined;
  if (rpcError) {
    throw new Error(`RPC Error: ${rpcError.message ?? "Unknown error"}`);
  }
  if (!quoteResponse.result) {
    throw new Error("No quote result received from Alchemy");
  }

  const quote = quoteResponse.result;
  const calls = (quote as { calls?: Array<{ to: string; data: string; value: string }> }).calls;
  let txHash: Hex | null = null;

  if (calls && Array.isArray(calls) && calls.length > 0) {
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const isLast = i === calls.length - 1;

      const { id } = await swapClient.sendCalls({
        account: accountAddress,
        calls: [
          {
            to: call.to as Address,
            data: appendBuilderCode(call.data as Hex),
            value: BigInt(call.value || "0"),
          },
        ],
      });

      const status = await swapClient.waitForCallsStatus({ id });
      if (status.status === "reverted") {
        throw new Error(`Transaction reverted for call ${i + 1}`);
      }
      const receipt = status.receipts?.[0]?.transactionHash;
      if (isLast && receipt) {
        txHash = receipt as Hex;
      }
    }
  } else {
    const quoteData = (quote as { data?: { target?: string; sender?: string; callData?: string; value?: string } }).data;
    if (!quoteData) {
      throw new Error("Invalid quote format: missing data or calls");
    }

    const target = (quoteData.target || quoteData.sender || accountAddress) as Address;
    const callData = quoteData.callData as Hex;
    const value = BigInt(quoteData.value || "0");

    const { id } = await swapClient.sendCalls({
      account: accountAddress,
      calls: [
        {
          to: target,
          data: appendBuilderCode(callData),
          value,
        },
      ],
    });

    const status = await swapClient.waitForCallsStatus({ id });
    if (status.status === "reverted") {
      throw new Error("Transaction reverted for legacy swap call");
    }
    txHash = (status.receipts?.[0]?.transactionHash as Hex) ?? null;
  }

  if (!txHash) {
    throw new Error("Failed to get transaction hash from swap execution");
  }

  return {
    transactionHash: txHash,
    success: true,
    message: "Swap executed successfully.",
  };
}
