import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import {
  requireWalletAuthFor,
  WalletAuthError,
} from '@/lib/auth/require-wallet';
import {
  fetchCreatorLivepeerMetrics,
  mergeCreatorAnalytics,
  type CreatorDbVideo,
} from '@/lib/livepeer/creator-analytics';
import { createServiceClient } from '@/lib/sdk/supabase/service';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { serverLogger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_RANGE_MS = 30 * 24 * 60 * 60 * 1000;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function parseDateParam(
  value: string | null,
  fallback: Date,
): Date {
  if (!value) return fallback;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return new Date(asNumber);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  const { searchParams } = request.nextUrl;
  const creatorIdRaw = searchParams.get('creatorId')?.trim() ?? '';
  if (!creatorIdRaw || !isAddress(creatorIdRaw)) {
    return NextResponse.json(
      { error: 'Valid creatorId is required', code: 'INVALID_CREATOR_ID' },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const creatorId = creatorIdRaw.toLowerCase();

  try {
    await requireWalletAuthFor(request, creatorId);
  } catch (authErr) {
    if (authErr instanceof WalletAuthError) {
      return NextResponse.json(
        { error: authErr.message, code: 'UNAUTHORIZED' },
        { status: authErr.status, headers: noStoreHeaders },
      );
    }
    throw authErr;
  }

  const now = new Date();
  const from = parseDateParam(
    searchParams.get('from'),
    new Date(now.getTime() - DEFAULT_RANGE_MS),
  );
  const to = parseDateParam(searchParams.get('to'), now);
  const timeStepParam = searchParams.get('timeStep');
  const timeStep =
    timeStepParam === 'hour' ||
    timeStepParam === 'day' ||
    timeStepParam === 'week' ||
    timeStepParam === 'month' ||
    timeStepParam === 'year'
      ? timeStepParam
      : 'day';

  try {
    const supabase = createServiceClient();
    const { data: dbRows, error } = await supabase
      .from('video_assets')
      .select(
        'playback_id, title, thumbnail_url, views_count, likes_count, asset_id',
      )
      .ilike('creator_id', creatorId)
      .in('status', ['published', 'minted'])
      .order('views_count', { ascending: false })
      .limit(200);

    if (error) {
      serverLogger.error('Creator analytics DB fetch failed:', error);
      return NextResponse.json(
        { error: 'Failed to load creator videos', code: 'DATABASE_ERROR' },
        { status: 503, headers: noStoreHeaders },
      );
    }

    const dbVideos = (dbRows ?? []) as CreatorDbVideo[];

    const livepeer = await fetchCreatorLivepeerMetrics({
      creatorId,
      from,
      to,
      timeStep,
    });

    const analytics = mergeCreatorAnalytics({
      dbVideos,
      livepeerByPlayback: livepeer.byPlayback,
      timeseries: livepeer.timeseries,
      livepeerAvailable: livepeer.available,
    });

    return NextResponse.json(
      {
        success: true,
        creatorId,
        from: from.toISOString(),
        to: to.toISOString(),
        timeStep,
        ...analytics,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    serverLogger.error('Creator analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'CREATOR_ANALYTICS_ERROR' },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
