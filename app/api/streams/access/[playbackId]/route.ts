import { NextRequest, NextResponse } from "next/server";
import { getStreamByPlaybackId } from "@/services/streams";
import { createServiceClient } from "@/lib/sdk/supabase/service";
import { isMeTokenGateActive } from "@/lib/utils/metoken-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ playbackId: string }> },
) {
  try {
    const { playbackId } = await params;
    if (!playbackId?.trim()) {
      return NextResponse.json({ error: "playbackId is required" }, { status: 400 });
    }

    const stream = await getStreamByPlaybackId(playbackId);
    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const requiresMetoken = isMeTokenGateActive(
      stream.requires_metoken,
      stream.metoken_price,
    );

    let meTokenSymbol: string | null = null;
    let meTokenAddress: string | null = null;

    if (requiresMetoken && stream.creator_id) {
      const supabase = createServiceClient();
      const { data: meToken } = await supabase
        .from("metokens")
        .select("address, symbol")
        .eq("owner_address", stream.creator_id.toLowerCase())
        .maybeSingle();

      meTokenSymbol = meToken?.symbol ?? null;
      meTokenAddress = meToken?.address ?? null;
    }

    return NextResponse.json({
      requiresMetoken,
      metokenPrice: requiresMetoken ? stream.metoken_price : null,
      meTokenSymbol,
      meTokenAddress,
      creatorAddress: stream.creator_id,
      streamName: stream.name ?? null,
      thumbnailUrl: stream.thumbnail_url ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch stream access metadata",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
