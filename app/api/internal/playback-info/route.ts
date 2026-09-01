import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { handlePlaybackInfo } from '@/lib/livepeer/playback-info-handler';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Internal, first-party playback info endpoint used by the in-app video player.
 * Not gated by Platform API / x402 payments — only rate-limited.
 * External consumers should use /api/livepeer/playback-info.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimiters.playbackInfo(request);
  if (rl) return rl;

  return handlePlaybackInfo(request);
}
