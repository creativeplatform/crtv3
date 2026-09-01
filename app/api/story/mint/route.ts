/**
 * API Route for Story Protocol NFT Minting
 * 
 * This API route handles Story Protocol transactions using a private key
 * since Story Protocol only supports eth_sendRawTransaction (not eth_sendTransaction).
 * 
 * IMPORTANT: Requires STORY_PROTOCOL_PRIVATE_KEY environment variable
 * This should be a private key for a wallet that has IP tokens for gas fees on Story Protocol
 */

import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { createCollectionAndMintVideoNFTOnStory } from "@/lib/sdk/nft/minting-service";
import type { Address } from "viem";
import { serverLogger } from "@/lib/utils/logger";
import { rateLimiters } from "@/lib/middleware/rateLimit";

export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.strict(request);
  if (rl) return rl;

  try {
    // Handle JSON parsing errors
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      serverLogger.error('Invalid JSON in request body:', jsonError);
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body'
        },
        { status: 400 }
      );
    }
    
    const {
      creatorAddress,
      recipient,
      metadataURI,
      collectionName,
      collectionSymbol,
    } = body;

    // Validate required fields
    if (!creatorAddress || !recipient || !metadataURI || !collectionName || !collectionSymbol) {
      const missingFields = [];
      if (!creatorAddress) missingFields.push('creatorAddress');
      if (!recipient) missingFields.push('recipient');
      if (!metadataURI) missingFields.push('metadataURI');
      if (!collectionName) missingFields.push('collectionName');
      if (!collectionSymbol) missingFields.push('collectionSymbol');
      
      return NextResponse.json(
        { 
          error: "Missing required fields",
          missingFields,
          hint: 'All of the following fields are required: creatorAddress, recipient, metadataURI, collectionName, collectionSymbol'
        },
        { status: 400 }
      );
    }
    
    // Validate address formats
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(creatorAddress)) {
      return NextResponse.json(
        { 
          error: "Invalid creatorAddress format",
          details: "creatorAddress must be a valid Ethereum address (0x followed by 40 hex characters)"
        },
        { status: 400 }
      );
    }
    
    if (!addressRegex.test(recipient)) {
      return NextResponse.json(
        { 
          error: "Invalid recipient format",
          details: "recipient must be a valid Ethereum address (0x followed by 40 hex characters)"
        },
        { status: 400 }
      );
    }
    
    // Validate metadataURI is a valid URL
    try {
      new URL(metadataURI);
    } catch {
      return NextResponse.json(
        { 
          error: "Invalid metadataURI format",
          details: "metadataURI must be a valid URL"
        },
        { status: 400 }
      );
    }

    // Story Protocol requires transactions to be signed locally (eth_sendRawTransaction)
    // The SDK needs a private key to sign transactions
    // 
    // IMPORTANT: The private key must be for the creator's address (creatorAddress)
    // This is a security concern - in production, consider:
    // 1. Using a dedicated service wallet that mints on behalf of users
    // 2. Implementing a secure key management system
    // 3. Using browser wallet extensions for user-controlled signing
    
    const privateKey = process.env.STORY_PROTOCOL_PRIVATE_KEY;
    
    if (!privateKey) {
      return NextResponse.json(
        { 
          error: "Story Protocol private key not configured",
          hint: "Set STORY_PROTOCOL_PRIVATE_KEY environment variable. " +
                "This should be the private key for a wallet that has IP tokens for gas fees on Story Protocol. " +
                "For production, consider using a dedicated service wallet."
        },
        { status: 500 }
      );
    }

    // Get the funding wallet address from the private key
    // The Story Protocol SDK needs the account address to match the private key
    // for proper signing. The funding wallet pays for transactions.
    let fundingWalletAddress: Address;
    try {
      const { privateKeyToAccount } = await import("viem/accounts");
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      fundingWalletAddress = await account.address;
      
      serverLogger.debug("Using funding wallet for Story Protocol transactions:", {
        fundingWallet: fundingWalletAddress,
        creatorAddress: creatorAddress,
        recipient: recipient,
      });
      
      // Note: The funding wallet address doesn't need to match the creator address
      // The funding wallet pays for gas, but the creator/recipient are used for NFT ownership
    } catch (e) {
      serverLogger.error("Could not get funding wallet address from private key:", e);
      return NextResponse.json(
        { 
          error: "Invalid private key",
          hint: "The STORY_PROTOCOL_PRIVATE_KEY environment variable contains an invalid private key."
        },
        { status: 500 }
      );
    }

    // Create and mint using the funding wallet address and private key for signing
    // The SDK will use the funding wallet to sign and send transactions
    // but the creator/recipient addresses determine NFT ownership
    const result = await createCollectionAndMintVideoNFTOnStory(
      fundingWalletAddress, // Use funding wallet address for SDK account (must match private key for signing)
      recipient as Address,
      metadataURI,
      collectionName,
      collectionSymbol,
      undefined, // No custom transport needed
      undefined, // No license params for now
      privateKey, // Use private key for signing
      creatorAddress as Address // Creator address for collection ownership
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    serverLogger.error("Story Protocol minting error:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for network/connection errors
      if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          {
            error: 'Network error',
            details: 'Unable to connect to Story Protocol. Please check your network connection and try again.'
          },
          { status: 503 }
        );
      }
      
      // Check for transaction errors
      if (error.message.includes('transaction') || error.message.includes('revert') || error.message.includes('execution reverted')) {
        return NextResponse.json(
          {
            error: 'Transaction failed',
            details: error.message
          },
          { status: 400 }
        );
      }
      
      // Check for insufficient funds errors
      if (error.message.includes('insufficient') || error.message.includes('balance') || error.message.includes('gas')) {
        return NextResponse.json(
          {
            error: 'Insufficient funds',
            details: 'The funding wallet does not have enough IP tokens to pay for gas fees on Story Protocol'
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to mint on Story Protocol",
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

