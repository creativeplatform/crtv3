import { NextRequest, NextResponse } from "next/server";
import { listClipsByParentPlaybackId } from "@/services/video-assets";
import { serverLogger } from "@/lib/utils/logger";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ playbackId: string }> }
) {
  const { playbackId } = await context.params;
  if (!playbackId) {
    return NextResponse.json({ error: "playbackId is required" }, { status: 400 });
  }

  try {
    const clips = await listClipsByParentPlaybackId(playbackId);
    return NextResponse.json({ clips });
  } catch (e: any) {
    serverLogger.error("Failed to list clips:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to list clips" },
      { status: 500 }
    );
  }
}
