import { NextRequest, NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { createClipVideoAsset } from "@/services/video-assets";
import { getClipThumbnailUrl } from "@/services/livepeer-clips";
import { getStreamByPlaybackId } from "@/services/streams";
import { serverLogger } from "@/lib/utils/logger";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const rl = await rateLimiters.strict(request);
  if (rl) return rl;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    assetId,
    playbackId,
    playbackUrl,
    name,
    parentPlaybackId,
    parentStoryIpId,
    clipStartMs,
    clipEndMs,
    clipperAddress,
  } = body ?? {};

  if (!assetId || !playbackId || !parentPlaybackId || clipStartMs == null || clipEndMs == null || !clipperAddress) {
    return NextResponse.json(
      {
        error: "Missing required fields",
        hint: "assetId, playbackId, parentPlaybackId, clipStartMs, clipEndMs, clipperAddress are required",
      },
      { status: 400 }
    );
  }
  if (!ADDRESS_REGEX.test(clipperAddress)) {
    return NextResponse.json({ error: "Invalid clipperAddress format" }, { status: 400 });
  }

  try {
    const [clipThumb, parentStream] = await Promise.all([
      getClipThumbnailUrl(playbackId),
      getStreamByPlaybackId(parentPlaybackId),
    ]);
    const resolvedThumbnail = clipThumb ?? parentStream?.thumbnail_url ?? null;

    const row = await createClipVideoAsset({
      assetId,
      playbackId,
      playbackUrl: playbackUrl ?? null,
      thumbnailUrl: resolvedThumbnail,
      name: name ?? null,
      parentPlaybackId,
      parentStoryIpId: parentStoryIpId ?? null,
      clipStartMs: Number(clipStartMs),
      clipEndMs: Number(clipEndMs),
      clipperAddress,
    });
    return NextResponse.json({ clip: row });
  } catch (e: any) {
    serverLogger.error("Failed to persist clip video asset:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to persist clip" },
      { status: 500 }
    );
  }
}
