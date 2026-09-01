/**
 * Prepare mint/register tx for client-side signing (creator-as-deployer).
 * Returns unsigned transaction params so the client can sign with the creator's wallet
 * and submit via eth_sendRawTransaction (e.g. through /api/story/rpc-proxy).
 */
import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { createStoryClient, getStoryRpcUrl } from "@/lib/sdk/story/client";
import { getOrCreateCreatorCollection } from "@/lib/sdk/story/collection-service";
import { mintAndRegisterIp } from "@/lib/sdk/story/spg-service";
import { createCaptureTransport, getCapturedTxs } from "@/lib/sdk/story/capture-transport";
import type { Address } from "viem";
import { serverLogger } from "@/lib/utils/logger";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";

function serializeTx(tx: { to: Address; data: `0x${string}`; value?: bigint; gas?: bigint; gasPrice?: bigint; chainId?: number }) {
  return {
    to: tx.to,
    data: tx.data,
    value: tx.value != null ? `0x${tx.value.toString(16)}` : "0x0",
    gas: tx.gas != null ? `0x${tx.gas.toString(16)}` : undefined,
    gasPrice: tx.gasPrice != null ? `0x${tx.gasPrice.toString(16)}` : undefined,
    chainId: tx.chainId,
  };
}

export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.strict(request);
  if (rl) return rl;

  try {
    const body = await request.json();
    const { creatorAddress, recipient, metadataURI, collectionName, collectionSymbol } = body;

    if (!creatorAddress || !recipient || !metadataURI || !collectionName || !collectionSymbol) {
      return NextResponse.json(
        { error: "Missing required fields", hint: "creatorAddress, recipient, metadataURI, collectionName, collectionSymbol" },
        { status: 400 }
      );
    }

    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(creatorAddress) || !addressRegex.test(recipient)) {
      return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
    }

    const normalizedCreator = creatorAddress.toLowerCase();
    const normalizedRecipient = recipient.toLowerCase();

    try {
      await requireWalletAuthFor(request, normalizedCreator);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json({ error: authErr.message }, { status: authErr.status });
      }
      throw authErr;
    }

    if (normalizedRecipient !== normalizedCreator) {
      return NextResponse.json(
        { error: "recipient must match creatorAddress for prepare-mint" },
        { status: 400 },
      );
    }

    const privateKey = process.env.STORY_PROTOCOL_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: "Story Protocol not configured", hint: "STORY_PROTOCOL_PRIVATE_KEY required to prepare collection" },
        { status: 500 }
      );
    }

    const { privateKeyToAccount } = await import("viem/accounts");
    const fundingAccount = privateKeyToAccount(privateKey as `0x${string}`);
    const fundingAddress = fundingAccount.address as Address;

    const rpcUrl = getStoryRpcUrl();
    const network = process.env.NEXT_PUBLIC_STORY_NETWORK || "testnet";
    const chainId = network === "mainnet" ? 1514 : 1315;

    const fundingClient = createStoryClient(fundingAddress, privateKey);
    const collectionAddress = await getOrCreateCreatorCollection(
      fundingClient,
      normalizedCreator as Address,
      collectionName,
      collectionSymbol
    );

    const captureKey = `prepare-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const captureTransport = createCaptureTransport(rpcUrl, captureKey);
    const captureClient = createStoryClient(normalizedCreator as Address, undefined, captureTransport);

    try {
      await mintAndRegisterIp(captureClient, {
        collectionAddress,
        recipient: normalizedRecipient as Address,
        metadataURI,
        allowDuplicates: false,
      });
    } catch (e) {
      const captured = getCapturedTxs(captureKey);
      if (captured.length === 0) {
        serverLogger.error("Prepare mint failed and no tx captured:", e);
        return NextResponse.json(
          { error: "Failed to build mint transaction", details: e instanceof Error ? e.message : String(e) },
          { status: 500 }
        );
      }
    }

    const transactions = getCapturedTxs(captureKey).map(serializeTx);
    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "No transaction captured" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      chainId,
      collectionAddress,
      transactions,
    });
  } catch (error) {
    serverLogger.error("Story prepare-mint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare mint" },
      { status: 500 }
    );
  }
}
