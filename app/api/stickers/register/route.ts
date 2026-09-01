import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { insertCampaignSticker } from "@/lib/sdk/supabase/campaign-stickers";
import { serverLogger } from "@/lib/utils/logger";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { verifyStickerCreationTx } from "@/lib/stickers/verifyStickerCreationTx";
import { TransactionVerificationError } from "@/lib/chain/verifyTransactionReceipt";

const bodySchema = z.object({
  proposalId: z.string().min(1),
  ipfsHash: z.string().min(1),
  brandAddress: z.string().refine(isAddress, "Invalid brandAddress"),
  transactionHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  name: z.string().optional(),
  imageUri: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  /** Optional client hint; ignored in favor of on-chain event */
  tokenId: z.number().optional(),
});

/** POST /api/stickers/register — persist sticker after verified on-chain createSticker */
export async function POST(req: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const body = parsed.data;

    try {
      await requireWalletAuthFor(req, body.brandAddress);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { error: authErr.message },
          { status: authErr.status }
        );
      }
      throw authErr;
    }

    let verified;
    try {
      verified = await verifyStickerCreationTx(
        body.transactionHash,
        body.brandAddress,
        body.proposalId,
        body.ipfsHash,
      );
    } catch (verifyErr) {
      if (verifyErr instanceof TransactionVerificationError) {
        return NextResponse.json({ error: verifyErr.message }, { status: 400 });
      }
      throw verifyErr;
    }

    const row = await insertCampaignSticker({
      tokenId: verified.tokenId,
      proposalId: verified.proposalId,
      ipfsHash: verified.uri,
      brandAddress: verified.admin,
      name: body.name,
      imageUri: body.imageUri,
      metadata: body.metadata,
    });

    return NextResponse.json({
      success: true,
      sticker: row,
      tokenId: verified.tokenId,
      txHash: verified.txHash,
    });
  } catch (error) {
    serverLogger.error("sticker register failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to register sticker";
    const status = message.includes("duplicate") || message.includes("unique")
      ? 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
