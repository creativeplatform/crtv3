import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import {
  insertStickerTip,
  listStickerTipsForVideo,
} from "@/lib/sdk/supabase/campaign-stickers";
import { MAX_HOLD_SECONDS } from "@/lib/sdk/heartbit/config";
import { serverLogger } from "@/lib/utils/logger";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";

const tipSchema = z.object({
  videoId: z.string().min(1),
  wallet: z.string().refine(isAddress, "Invalid wallet"),
  stickerTokenId: z.number().nullable().optional(),
  stickerIpfsHash: z.string().nullable().optional(),
  compositeHash: z.string().min(1),
  seconds: z.number().int().positive().max(MAX_HOLD_SECONDS),
  // Soft sanity bound only — not a product tip cap (rate × hold drives amount).
  usdcAmount: z.number().positive().max(MAX_HOLD_SECONDS),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
});

/** POST — record a hold-to-tip event (authenticated tipper) */
export async function POST(req: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  try {
    const json = await req.json();
    const parsed = tipSchema.safeParse(json);
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

    const row = await insertStickerTip({
      videoId: body.videoId,
      wallet: body.wallet,
      stickerTokenId: body.stickerTokenId,
      stickerIpfsHash: body.stickerIpfsHash,
      compositeHash: body.compositeHash,
      seconds: body.seconds,
      usdcAmount: body.usdcAmount,
      txHash: body.txHash,
    });

    return NextResponse.json({ success: true, tip: row });
  } catch (error) {
    serverLogger.error("record tip failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to record tip",
      },
      { status: 500 }
    );
  }
}

/** GET ?videoId= — list tip ledger for a video (public read) */
export async function GET(req: NextRequest) {
  const rl = await rateLimiters.generous(req);
  if (rl) return rl;

  try {
    const videoId = req.nextUrl.searchParams.get("videoId");
    if (!videoId) {
      return NextResponse.json({ error: "videoId required" }, { status: 400 });
    }
    const wallet = req.nextUrl.searchParams.get("wallet");
    const tips = await listStickerTipsForVideo(videoId, wallet ?? undefined);
    return NextResponse.json({ tips });
  } catch (error) {
    serverLogger.error("list tips failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list tips",
      },
      { status: 500 }
    );
  }
}
