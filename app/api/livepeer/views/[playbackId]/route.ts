import { NextRequest, NextResponse } from 'next/server';
import { fetchAllViews } from '@/app/api/livepeer/views';
import { createServiceClient } from '@/lib/sdk/supabase/service';
import {
  mergeViewCounts,
  resolveViewCountSource,
  sumLivepeerViewMetrics,
} from '@/lib/livepeer/view-count';
import { getStoredViewsCount } from '@/lib/livepeer/sync-view-count';
import { serverLogger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

/**
 * Read-only endpoint: returns max(Livepeer views, database views_count).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbackId: string }> }
) {
  try {
    const { playbackId } = await params;

    if (!playbackId) {
      return NextResponse.json(
        { error: 'Playback ID is required' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const metrics = await fetchAllViews(playbackId);
    const livepeerTotal = metrics ? sumLivepeerViewMetrics(metrics) : 0;

    if (metrics) {
      const livepeerTotal =
        (metrics.viewCount ?? 0) + (metrics.legacyViewCount ?? 0);

      if (livepeerTotal > 0) {
        return NextResponse.json(
          {
            success: true,
            source: 'livepeer' as const,
            ...metrics,
          },
          { headers: noStoreHeaders }
        );
      }
    }

    // Livepeer returned 0 or failed — fall back to database views_count
    const supabase = await createClient();
    const { data: videoAsset } = await supabase
      .from('video_assets')
      .select('views_count')
      .eq('playback_id', playbackId)
      .single();

    const dbViewCount = videoAsset?.views_count ?? 0;

    return NextResponse.json(
      {
        success: true,
        source: 'database' as const,
        playbackId,
        viewCount: dbViewCount,
        playtimeMins: metrics?.playtimeMins ?? 0,
        legacyViewCount: 0,
      },
      { headers: noStoreHeaders }
    );

  } catch (error) {
    serverLogger.error('Error fetching view metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
