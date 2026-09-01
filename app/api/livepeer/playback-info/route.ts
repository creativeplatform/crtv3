import { NextRequest, NextResponse } from 'next/server';
import {
  platformApiOptionsResponse,
  requirePlatformApiAccess,
} from '@/lib/middleware/platformApiAccess';
import { handlePlaybackInfo } from '@/lib/livepeer/playback-info-handler';

export async function OPTIONS() {
  return platformApiOptionsResponse();
}

/**
 * Public Platform API route for playback info.
 * Requires an API key or x402 payment. First-party app pages should call
 * /api/internal/playback-info instead.
 */
export async function GET(request: NextRequest) {
  const access = await requirePlatformApiAccess(request, { resource: 'playback.info' });
  if (!access.allowed) {
    return access.response;
  }

  return handlePlaybackInfo(request);
}
