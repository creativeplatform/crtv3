"use server";

import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { createPublicClient, Address } from "viem";
import { alchemy, base } from "@account-kit/infra";
import type { Chain } from "viem";
import { generateAccessKey, validateAccessKey } from "@/lib/access-key";
import { getSmartAccountClient } from "@account-kit/core";
import { config } from "@/config";
import { serverLogger } from "@/lib/utils/logger";

// Import ERC1155 ABI
const erc1155ABI = [
  {
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_id", type: "uint256" },
    ],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// Define chain mapping (Base only)
const chainMapping: Record<number, Chain> = {
  8453: base,
};

export interface WebhookPayload {
  accessKey: string;
  context: WebhookContext;
  timestamp: number;
}

export interface WebhookContext {
  creatorAddress: string;
  tokenId: string;
  contractAddress: string;
  chain: number;
}

export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  try {
    // Handle JSON parsing errors
    let payload: WebhookPayload;
    try {
      payload = await request.json();
    } catch (jsonError) {
      serverLogger.error('Invalid JSON in request body:', jsonError);
      return NextResponse.json(
        {
          allowed: false,
          message: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    serverLogger.debug('Token gate payload:', payload);

    if (
      !payload.accessKey ||
      !payload.context.creatorAddress ||
      !payload.context.tokenId ||
      !payload.context.contractAddress ||
      !payload.context.chain ||
      !payload.timestamp
    ) {
      return NextResponse.json(
        {
          allowed: false,
          message: "Bad request, missing required fields",
        },
        { status: 400 }
      );
    }

    // Validate timestamp age < 5 minutes
    const MAX_TIMESTAMP_AGE = 5 * 60 * 1000;
    const now = Date.now();

    if (Math.abs(now - payload.timestamp) > MAX_TIMESTAMP_AGE) {
      return NextResponse.json(
        {
          allowed: false,
          message: "Request timestamp too old or from future",
        },
        { status: 400 }
      );
    }

    // Implement custom access control logic here
    const isAccessAllowed = await validateAccess(payload);

    serverLogger.debug('Access allowed:', isAccessAllowed);

    if (isAccessAllowed) {
      return NextResponse.json(
        {
          allowed: true,
          message: "Access granted",
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          allowed: false,
          message: "Access denied",
        },
        { status: 403 }
      );
    }
  } catch (error) {
    serverLogger.error("Access control error:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for network/connection errors
      if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          {
            allowed: false,
            message: "Network error. Unable to verify access.",
          },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      {
        allowed: false,
        message: error instanceof Error ? error.message : "Internal server error",
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address") as string;
    const creatorAddress = request.nextUrl.searchParams.get(
      "creatorAddress"
    ) as string;
    const tokenId = request.nextUrl.searchParams.get("tokenId") as string;
    const contractAddress = request.nextUrl.searchParams.get(
      "contractAddress"
    ) as string;
    const chain = parseInt(request.nextUrl.searchParams.get("chain") as string);

    serverLogger.debug('Token gate GET request:', {
      address,
      creatorAddress,
      tokenId,
      contractAddress,
      chain,
    });

    if (!address /* || !context */) {
      return NextResponse.json(
        {
          allowed: false,
          message: "Bad request, missing required fields",
        },
        { status: 400 }
      );
    }

    const accessKey = generateAccessKey(address, {
      type: "token-gate",
      rules: {
        chain,
        contractAddress,
        tokenId,
        creatorAddress,
      },
    });

    serverLogger.debug('Generated access key:', accessKey);

    if (accessKey) {
      return NextResponse.json(
        {
          allowed: true,
          accessKey: accessKey,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          allowed: false,
          message: "Failed to generate access key.",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    serverLogger.error("Generate access key error:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for validation errors
      if (error.message.includes('invalid') || error.message.includes('required')) {
        return NextResponse.json(
          {
            allowed: false,
            message: error.message,
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      {
        allowed: false,
        message: error instanceof Error ? error.message : "Internal server error",
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

async function validateAccess(payload: WebhookPayload): Promise<boolean> {
  const { accessKey, context, timestamp } = payload;

  try {
    // Get the smart account client
    const client = await getSmartAccountClient(
      {
        type: "ModularAccountV2",
        accountParams: {
          mode: "default",
        },
      },
      config
    );

    if (!client || !client.address) return false;

    // Validate the access key
    const isValidKey = validateAccessKey(accessKey, client.address, {
      type: "token-gate",
      rules: {
        chain: context.chain,
        contractAddress: context.contractAddress,
        tokenId: context.tokenId,
        creatorAddress: context.creatorAddress,
      },
    });
    if (!isValidKey) return false;

    // Check if user has required token balance
    const hasTokens = await checkUserTokenBalances(client.address, context);
    if (!hasTokens) return false;

    // Check if the asset is accessible
    const isAccessible = await checkAssetAccessibility(context);
    if (!isAccessible) return false;

    return true;
  } catch (error) {
    serverLogger.error("Validate access error:", error);
    return false;
  }
}

async function checkUserTokenBalances(
  address: string,
  context: WebhookContext
): Promise<boolean> {
  try {
    // Get the chain we are using
    const chain = chainMapping[context.chain];

    // If the chain is not supported, return false
    if (!chain) {
      serverLogger.error("Chain not supported");
      return false;
    }

    // Get a public client for the chain
    const publicClient = createPublicClient({
      chain,
      transport: alchemy({
        apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY as string,
      }),
    });

    // Check the user token balance
    const videoTokenBalance = (await publicClient.readContract({
      address: context.contractAddress as Address,
      abi: erc1155ABI,
      functionName: "balanceOf",
      args: [address as Address, BigInt(context.tokenId)],
    })) as bigint;

    serverLogger.debug('Video token balance:', videoTokenBalance.toString());

    return videoTokenBalance > BigInt(0);
  } catch (error) {
    serverLogger.error("Error checking token balances:", error);
    return false;
  }
}

async function checkAssetAccessibility(
  context: WebhookContext
): Promise<boolean> {
  // Implement actual asset accessibility checking logic
  // For example, check if asset is published or not restricted
  return true;
}
