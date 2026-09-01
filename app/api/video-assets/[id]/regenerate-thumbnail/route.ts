import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { getVideoAssetById, updateVideoAsset } from "@/services/video-assets";
import { regenerateThumbnailFromLivepeer } from "@/lib/utils/thumbnail-regeneration";
import { serverLogger } from "@/lib/utils/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const videoId = parseInt(id, 10);

    if (isNaN(videoId)) {
      return NextResponse.json(
        { error: "Invalid video ID" },
        { status: 400 }
      );
    }

    // Fetch the video asset to get playback ID
    const asset = await getVideoAssetById(videoId);

    if (!asset) {
      return NextResponse.json(
        { error: "Video asset not found" },
        { status: 404 }
      );
    }

    if (!asset.playback_id) {
      return NextResponse.json(
        { error: "Video asset does not have a playback ID" },
        { status: 400 }
      );
    }

    serverLogger.debug(`[RegenerateThumbnail] Starting regeneration for video ID: ${videoId}, playbackId: ${asset.playback_id}`);

    // Regenerate thumbnail from Livepeer
    const result = await regenerateThumbnailFromLivepeer(
      asset.playback_id,
      asset.asset_id
    );

    if (!result.success || !result.thumbnailUrl) {
      return NextResponse.json(
        {
          error: result.error || "Failed to regenerate thumbnail",
        },
        { status: 500 }
      );
    }

    // Update the database with the new thumbnail URL
    await updateVideoAsset(videoId, {
      thumbnailUri: result.thumbnailUrl,
    });

    serverLogger.debug(`[RegenerateThumbnail] ✅ Successfully regenerated thumbnail for video ID: ${videoId}`);

    return NextResponse.json(
      {
        success: true,
        thumbnailUrl: result.thumbnailUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    serverLogger.error("[RegenerateThumbnail] Error regenerating thumbnail:", error);
    return NextResponse.json(
      {
        error: "Failed to regenerate thumbnail",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
