import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { insertStickerClaim } from "@/lib/sdk/supabase/campaign-stickers";
import { serverLogger } from "@/lib/utils/logger";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { verifyStickerClaimTx } from "@/lib/stickers/verifyStickerClaimTx";
import { TransactionVerificationError } from "@/lib/chain/verifyTransactionReceipt";

const bodySchema = z.object({
  tokenId: z.number().int().nonnegative(),
  wallet: z.string().refine(isAddress, "Invalid wallet"),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  vp: z.number().optional(),
  choice: z.union([z.string(), z.number()]).optional(),
});

/** POST /api/stickers/record-claim — persist a verified on-chain claim */
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
      await requireWalletAuthFor(req, body.wallet);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { error: authErr.message },
          { status: authErr.status }
        );
      }
      throw authErr;
    }

    try {
      await verifyStickerClaimTx(body.txHash, body.tokenId, body.wallet);
    } catch (verifyErr) {
      if (verifyErr instanceof TransactionVerificationError) {
        return NextResponse.json({ error: verifyErr.message }, { status: 400 });
      }
      throw verifyErr;
    }

    const row = await insertStickerClaim({
      tokenId: body.tokenId,
      wallet: body.wallet,
      txHash: body.txHash,
      vp: body.vp,
      choice:
        body.choice !== undefined ? String(body.choice) : undefined,
    });

    return NextResponse.json({ success: true, claim: row });
  } catch (error) {
    serverLogger.error("record-claim failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to record claim",
      },
      { status: 500 }
    );
  }
}
