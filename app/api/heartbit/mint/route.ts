import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { HeartBitClient } from "@/lib/sdk/heartbit/client";
import {
  DEFAULT_HEARTBIT_CHAIN,
  MAX_HOLD_SECONDS,
} from "@/lib/sdk/heartbit/config";
import { serverLogger } from "@/lib/utils/logger";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";

const bodySchema = z.object({
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive(),
  hash: z.string().min(1).max(512),
  account: z.string().refine(isAddress, "Invalid account"),
});

/**
 * POST /api/heartbit/mint
 * Unsigned gasless mint via Fileverse relayer (works with smart accounts).
 */
export async function POST(req: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.strict(req);
  if (rl) return rl;

  try {
    const apiKey = process.env.FILEVERSE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "FILEVERSE_API_KEY is not configured" },
        { status: 503 }
      );
    }

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
      await requireWalletAuthFor(req, body.account);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { error: authErr.message },
          { status: authErr.status }
        );
      }
      throw authErr;
    }

    if (body.endTime <= body.startTime) {
      return NextResponse.json(
        { error: "endTime must be after startTime" },
        { status: 400 }
      );
    }

    if (body.endTime - body.startTime > MAX_HOLD_SECONDS) {
      return NextResponse.json(
        {
          error: `Hold duration exceeds maximum (${MAX_HOLD_SECONDS}s)`,
        },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - body.endTime) > 120) {
      return NextResponse.json(
        { error: "endTime is too far from current time" },
        { status: 400 }
      );
    }

    const client = new HeartBitClient(DEFAULT_HEARTBIT_CHAIN);
    const result = await client.unSignedMintHeartBit({
      startTime: body.startTime,
      endTime: body.endTime,
      hash: body.hash,
      account: body.account.toLowerCase(),
      apiKey,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    serverLogger.error("heartbit mint failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to mint HeartBit",
      },
      { status: 500 }
    );
  }
}
