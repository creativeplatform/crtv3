import { NextRequest, NextResponse } from "next/server";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { createServiceClient } from "@/lib/sdk/supabase/service";
import { serverLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playbackId: string }> }
) {
  // BotID omitted: Deep Analysis false-positives blocked legitimate play increments.
  const rl = await rateLimiters.viewIncrement(request);
  if (rl) return rl;

  try {
    const { playbackId } = await params;

    if (!playbackId || !playbackId.trim()) {
      return NextResponse.json(
        { error: "Playback ID is required", code: "PLAYBACK_ID_REQUIRED" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Atomically increment view count in database via RPC to prevent race conditions
    const { data: newViews, error } = await supabase.rpc("increment_video_views", {
      p_playback_id: playbackId,
    });

    if (error) {
      throw error;
    }

    // RPC returns NULL when no video_assets row matches playback_id
    if (newViews == null) {
      return NextResponse.json(
        {
          error: "Video not found for playback ID",
          code: "VIDEO_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      playbackId,
      viewCount: Number(newViews),
    });
  } catch (error) {
    serverLogger.error("Error incrementing view count:", error);
    return NextResponse.json(
      {
        error: "Database error",
        code: "DATABASE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
