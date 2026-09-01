import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { upsertHackBetaSubmission } from "@/lib/sdk/supabase/submission-upserts";
import { serverLogger } from "@/lib/utils/logger";

const bodySchema = z.object({
  wallet_address: z.string().refine(isAddress, "Invalid wallet"),
  video_asset_id: z.string().min(1),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  playback_id: z.string().optional().nullable(),
  thumbnail_url: z.string().optional().nullable(),
  grove_url: z.string().optional().nullable(),
  grove_hash: z.string().optional().nullable(),
});

/** POST /api/hack-beta/submit — wallet-auth upsert for HACKATHON BETA entries */
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
        { status: 400 },
      );
    }

    const body = parsed.data;
    let verifiedAddress: string;
    try {
      ({ address: verifiedAddress } = await requireWalletAuthFor(
        req,
        body.wallet_address,
      ));
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { error: authErr.message },
          { status: authErr.status },
        );
      }
      throw authErr;
    }

    const submission = await upsertHackBetaSubmission({
      ...body,
      wallet_address: verifiedAddress,
    });
    return NextResponse.json({ ok: true, submission });
  } catch (error) {
    serverLogger.error("[hack-beta/submit] failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to submit hack beta entry",
      },
      { status: 500 },
    );
  }
}
