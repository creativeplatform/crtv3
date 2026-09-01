import { NextRequest, NextResponse } from 'next/server';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/sdk/supabase/service';
import { fetchAllViews } from '@/app/api/livepeer/views';
import { sumLivepeerViewMetrics } from '@/lib/livepeer/view-count';
import {
  getStoredViewsCount,
  syncStoredViewsCount,
} from '@/lib/livepeer/sync-view-count';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import {
  LIVEPEER_NOT_CONFIGURED,
} from '@/lib/sdk/livepeer/studioAuth';

function syncViewsErrorResponse(error: unknown) {
  serverLogger.error('Error syncing view count:', error);

  if (error instanceof Error) {
    if (
      error.message.includes('Livepeer') ||
      error.message.includes('playback')
    ) {
      return NextResponse.json(
        {
          error: 'Livepeer API error',
          code: 'LIVEPEER_SYNC_ERROR',
          details:
            'Unable to fetch view metrics from Livepeer. Please try again later.',
        },
        { status: 503 },
      );
    }

    if (
      error.message.includes('database') ||
      error.message.includes('connection')
    ) {
      return NextResponse.json(
        {
          error: 'Database error',
          code: 'DATABASE_ERROR',
          details:
            'Unable to update view count in database. Please try again later.',
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'SYNC_VIEWS_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    },
    { status: 500 },
  );
}

async function syncViewsForPlayback(
  supabase: SupabaseClient,
  playbackId: string,
) {
  const viewsResult = await fetchAllViews(playbackId);

  if (!viewsResult.ok) {
    const storedCount = await getStoredViewsCount(supabase, playbackId);

    if (viewsResult.reason === 'not_configured') {
      return NextResponse.json(
        {
          error: 'Livepeer is not configured',
          code: LIVEPEER_NOT_CONFIGURED,
        },
        { status: 503 },
      );
    }

    if (
      viewsResult.reason === 'upstream_error' &&
      (viewsResult.status === 401 || viewsResult.status === 403)
    ) {
      serverLogger.warn(
        `View sync auth failed for ${playbackId}: falling back to stored count`,
      );
    } else {
      serverLogger.warn(
        `View sync skipped for ${playbackId}: Livepeer metrics unavailable (${viewsResult.reason})`,
      );
    }

    return NextResponse.json({
      success: true,
      playbackId,
      viewCount: storedCount,
      livepeerSynced: false,
      code: 'LIVEPEER_VIEWS_UNAVAILABLE',
    });
  }

  const livepeerTotal = sumLivepeerViewMetrics(viewsResult.metrics);
  const { viewCount } = await syncStoredViewsCount(
    supabase,
    playbackId,
    livepeerTotal,
  );

  return NextResponse.json({
    success: true,
    playbackId,
    viewCount,
    livepeerSynced: true,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playbackId: string }> },
) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    const { playbackId } = await params;

    if (!playbackId) {
      return NextResponse.json(
        { error: 'Playback ID is required', code: 'PLAYBACK_ID_REQUIRED' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    return await syncViewsForPlayback(supabase, playbackId);
  } catch (error) {
    return syncViewsErrorResponse(error);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ playbackId: string }> },
) {
  try {
    const { playbackId } = await params;

    if (!playbackId) {
      return NextResponse.json(
        { error: 'Playback ID is required', code: 'PLAYBACK_ID_REQUIRED' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    return await syncViewsForPlayback(supabase, playbackId);
  } catch (error) {
    return syncViewsErrorResponse(error);
  }
}
