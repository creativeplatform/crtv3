import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { upsertSongCupSubmission } from "@/lib/sdk/supabase/submission-upserts";
import { serverLogger } from "@/lib/utils/logger";

const bodySchema = z.object({
  wallet_address: z.string().refine(isAddress, "Invalid wallet"),
  grove_url: z.string().min(1),
  grove_hash: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  artist_handle: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  cover_url: z.string().optional().nullable(),
  cover_hash: z.string().optional().nullable(),
  attestation_uid: z.string().optional().nullable(),
  post_id: z.string().optional().nullable(),
});

/** POST /api/song-cup/submit — wallet-auth upsert for Song Cup entries */
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

    const submission = await upsertSongCupSubmission({
      ...body,
      wallet_address: verifiedAddress,
    });
    return NextResponse.json({ ok: true, submission });
  } catch (error) {
    serverLogger.error("[song-cup/submit] failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to submit song cup entry",
      },
      { status: 500 },
    );
  }
}
