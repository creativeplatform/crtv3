/**
 * API Route for Factory-Based Collection Deployment
 * 
 * This API route handles collection deployment via the CreatorIPCollectionFactory.
 * Since the factory requires the owner's private key (onlyOwner modifier),
 * this must be called server-side.
 * 
 * IMPORTANT: Requires FACTORY_OWNER_PRIVATE_KEY environment variable
 * This should be the private key for the factory owner address.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getStoryRpcUrl } from "@/lib/sdk/story/client";
import { deployCreatorCollection, getCollectionBytecode, getFactoryContractAddress } from "@/lib/sdk/story/factory-contract-service";
import type { Address } from "viem";
import { serverLogger } from "@/lib/utils/logger";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { isValidEthAddress, normalizeEthAddress } from "@/lib/auth/validate-address";

/**
 * Story Protocol chain configuration
 */
const STORY_NETWORK = process.env.NEXT_PUBLIC_STORY_NETWORK || "testnet";
const STORY_TESTNET_CHAIN_ID = 1315; // Aeneid testnet
const STORY_MAINNET_CHAIN_ID = 1514; // Story mainnet
const CHAIN_ID = STORY_NETWORK === "mainnet" ? STORY_MAINNET_CHAIN_ID : STORY_TESTNET_CHAIN_ID;

export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.strict(request);
  if (rl) return rl;

  try {
    const body = await request.json();
    const {
      creatorAddress,
      collectionName,
      collectionSymbol,
    } = body;

    // Validate required fields
    if (!creatorAddress || !collectionName || !collectionSymbol) {
      return NextResponse.json(
        { error: "Missing required fields: creatorAddress, collectionName, collectionSymbol" },
        { status: 400 }
      );
    }

    const normalizedCreator = normalizeEthAddress(String(creatorAddress));

    if (!isValidEthAddress(normalizedCreator)) {
      return NextResponse.json({ error: "Invalid creatorAddress format" }, { status: 400 });
    }

    try {
      await requireWalletAuthFor(request, normalizedCreator);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json({ error: authErr.message }, { status: authErr.status });
      }
      throw authErr;
    }

    // Check factory configuration
    const factoryAddress = getFactoryContractAddress();
    if (!factoryAddress) {
      return NextResponse.json(
        { error: "Factory contract address not configured. Set NEXT_PUBLIC_CREATOR_IP_FACTORY_ADDRESS" },
        { status: 500 }
      );
    }

    // Get collection bytecode
    const bytecode = getCollectionBytecode();
    if (!bytecode) {
      return NextResponse.json(
        { error: "Collection bytecode not configured. Set COLLECTION_BYTECODE environment variable" },
        { status: 500 }
      );
    }

    // Get factory owner private key
    const factoryOwnerPrivateKey = process.env.FACTORY_OWNER_PRIVATE_KEY;
    if (!factoryOwnerPrivateKey) {
      return NextResponse.json(
        { error: "Factory owner private key not configured. Set FACTORY_OWNER_PRIVATE_KEY" },
        { status: 500 }
      );
    }

    // Create wallet client with factory owner account
    const account = privateKeyToAccount(factoryOwnerPrivateKey as `0x${string}`);
    const rpcUrl = getStoryRpcUrl();
    
    const walletClient = createWalletClient({
      account,
      chain: {
        id: CHAIN_ID,
        name: STORY_NETWORK === "mainnet" ? "Story Mainnet" : "Story Testnet (Aeneid)",
        nativeCurrency: {
          name: "IP Token",
          symbol: "IP",
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: [rpcUrl],
          },
        },
      },
      transport: http(rpcUrl),
    });

    // Deploy collection via factory
    const result = await deployCreatorCollection(
      walletClient,
      normalizedCreator as Address,
      collectionName,
      collectionSymbol,
      bytecode
    );

    return NextResponse.json({
      success: true,
      collectionAddress: result.collectionAddress,
      txHash: result.txHash,
    });
  } catch (error) {
    serverLogger.error("Factory collection deployment error:", error);
    return NextResponse.json(
      {
        error: "Collection deployment failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
