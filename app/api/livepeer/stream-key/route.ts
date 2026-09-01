import { NextRequest, NextResponse } from "next/server";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { resolveStreamForCreator } from "@/services/streams";

/**
 * Owner-only: return RTMP/WHIP stream key for the authenticated creator's channel.
 */
export async function GET(req: NextRequest) {
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  const creatorAddress = req.nextUrl.searchParams.get("creatorAddress")?.trim();
  if (!creatorAddress || !/^0x[a-fA-F0-9]{40}$/.test(creatorAddress)) {
    return NextResponse.json({ error: "Valid creatorAddress query param required" }, { status: 400 });
  }

  const legacyCreatorAddress =
    req.nextUrl.searchParams.get("legacyCreatorAddress")?.trim() || undefined;

  const normalizedCreator = creatorAddress.toLowerCase();

  try {
    await requireWalletAuthFor(req, normalizedCreator);
  } catch (authErr) {
    if (authErr instanceof WalletAuthError) {
      return NextResponse.json({ error: authErr.message }, { status: authErr.status });
    }
    throw authErr;
  }

  const stream = await resolveStreamForCreator(
    normalizedCreator,
    legacyCreatorAddress?.toLowerCase(),
  );
  if (!stream) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  return NextResponse.json({
    streamId: stream.stream_id,
    playbackId: stream.playback_id,
    streamKey: stream.stream_key,
  });
}
