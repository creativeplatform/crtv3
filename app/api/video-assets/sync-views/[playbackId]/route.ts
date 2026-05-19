import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/sdk/supabase/service';
import { fetchAllViews } from '@/app/api/livepeer/views';
import { sumLivepeerViewMetrics } from '@/lib/livepeer/view-count';
import { syncStoredViewsCount } from '@/lib/livepeer/sync-view-count';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

function syncViewsErrorResponse(error: unknown) {
  serverLogger.error('Error syncing view count:', error);

  if (error instanceof Error) {
    if (error.message.includes('Livepeer') || error.message.includes('playback')) {
      return NextResponse.json(
        {
          error: 'Livepeer API error',
          details: 'Unable to fetch view metrics from Livepeer. Please try again later.',
        },
        { status: 503 }
      );
    }

    if (error.message.includes('database') || error.message.includes('connection')) {
      return NextResponse.json(
        {
          error: 'Database error',
          details: 'Unable to update view count in database. Please try again later.',
        },
        { status: 503 }
      );
    }
  }

  return NextResponse.json(
    {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    },
    { status: 500 }
  );
}

export async function syncViewsForPlayback(
  supabase: SupabaseClient,
  playbackId: string,
) {
  const metrics = await fetchAllViews(playbackId);
  if (!metrics) {
    return NextResponse.json(
      { error: 'Failed to fetch view metrics from Livepeer' },
      { status: 500 }
    );
  }

  const livepeerTotal = sumLivepeerViewMetrics(metrics);
  const { viewCount } = await syncStoredViewsCount(
    supabase,
    playbackId,
    livepeerTotal,
  );

  return NextResponse.json({
    success: true,
    playbackId,
    viewCount,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playbackId: string }> }
) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    const { playbackId } = await params;

    if (!playbackId) {
      return NextResponse.json(
        { error: 'Playback ID is required' },
        { status: 400 }
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
  { params }: { params: Promise<{ playbackId: string }> }
) {
  try {
    const { playbackId } = await params;

    if (!playbackId) {
      return NextResponse.json(
        { error: 'Playback ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    return await syncViewsForPlayback(supabase, playbackId);
  } catch (error) {
    return syncViewsErrorResponse(error);
  }
}
