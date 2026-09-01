import { NextRequest, NextResponse } from 'next/server';
import { getStreamByPlaybackId } from '@/services/streams';

/** Lens checkLiveAPI-compatible endpoint: { isLive: boolean } */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ playbackId: string }> },
) {
  try {
    const { playbackId } = await params;
    if (!playbackId?.trim()) {
      return NextResponse.json({ isLive: false }, { status: 400 });
    }

    const stream = await getStreamByPlaybackId(playbackId);
    return NextResponse.json({ isLive: Boolean(stream?.is_live) });
  } catch {
    return NextResponse.json({ isLive: false }, { status: 500 });
  }
}
