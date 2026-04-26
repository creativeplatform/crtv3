import { NextRequest, NextResponse } from 'next/server';
import { fetchAllViews } from '@/app/api/livepeer/views';
import { createClient } from '@/lib/sdk/supabase/server';
import { serverLogger } from '@/lib/utils/logger';

/**
 * Read-only endpoint to fetch view metrics from Livepeer
 * Falls back to database views_count if Livepeer API fails or returns 0
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
        { status: 400 }
      );
    }

    // Fetch metrics from Livepeer API
    const metrics = await fetchAllViews(playbackId);

    if (metrics) {
      const livepeerTotal = (metrics.viewCount ?? 0) + (metrics.legacyViewCount ?? 0);

      if (livepeerTotal > 0) {
        return NextResponse.json({
          success: true,
          ...metrics,
        });
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

    return NextResponse.json({
      success: true,
      playbackId,
      viewCount: dbViewCount,
      playtimeMins: metrics?.playtimeMins ?? 0,
      legacyViewCount: 0,
    });

  } catch (error) {
    serverLogger.error('Error fetching view metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

