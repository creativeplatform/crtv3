import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { getActiveOverlayByPlaybackId } from "@/lib/sdk/supabase/shoppable-campaigns";
import { serverLogger } from "@/lib/utils/logger";

export const revalidate = 86400;

/**
 * GET /api/campaigns/by-playback/[playbackId]
 * Public annotations for an active in-window shoppable campaign.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbackId: string }> }
) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  const { playbackId } = await params;
  if (!playbackId || playbackId.length > 128) {
    return NextResponse.json({ error: "Invalid playbackId" }, { status: 400 });
  }

  try {
    const payload = await getActiveOverlayByPlaybackId(playbackId);
    if (!payload) {
      return NextResponse.json(
        { campaignId: null, annotations: [] },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "public, s-maxage=60, stale-while-revalidate=300",
          },
        }
      );
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    serverLogger.error("[by-playback] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lookup failed" },
      { status: 500 }
    );
  }
}
