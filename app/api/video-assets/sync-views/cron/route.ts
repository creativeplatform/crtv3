import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/sdk/supabase/service';
import { fetchAllViews } from '@/app/api/livepeer/views';
import { mergeViewCounts, sumLivepeerViewMetrics } from '@/lib/livepeer/view-count';
import { serverLogger } from '@/lib/utils/logger';

export const maxDuration = 300; // 5 minutes for cron jobs
export const dynamic = 'force-dynamic';

/**
 * Cron job to sync view counts from Livepeer to Supabase
 * Runs daily to catch videos that don't get client-side syncing
 * Schedule: see `vercel.json` crons (`/api/video-assets/sync-views/cron`).
 *
 * Security: Requires CRON_SECRET in Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron or authorized source
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      serverLogger.error('Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    serverLogger.debug('[Cron] Starting view count sync job');

    const supabase = createServiceClient();
    
    // Fetch all published videos with playback IDs
    const { data: videos, error } = await supabase
      .from('video_assets')
      .select('id, playback_id, views_count, title')
      .eq('status', 'published')
      .not('playback_id', 'is', null);

    if (error) {
      serverLogger.error('[Cron] Failed to fetch videos:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      serverLogger.debug('[Cron] No published videos found');
      return NextResponse.json({
        success: true,
        message: 'No videos to sync',
        totalVideos: 0,
      });
    }

    serverLogger.debug(`[Cron] Found ${videos.length} published videos to sync`);

    // Process in batches to avoid rate limits and timeouts
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay
    
    let successCount = 0;
    let errorCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < videos.length; i += BATCH_SIZE) {
      const batch = videos.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(videos.length / BATCH_SIZE);
      
      serverLogger.debug(`[Cron] Processing batch ${batchNumber}/${totalBatches}`);
      
      await Promise.all(
        batch.map(async (video) => {
          try {
            const metrics = await fetchAllViews(video.playback_id);
            
            if (metrics) {
              const livepeerTotal = sumLivepeerViewMetrics(metrics);
              const merged = mergeViewCounts(video.views_count ?? 0, livepeerTotal);

              if (merged !== video.views_count) {
                const { error: updateError } = await supabase
                  .from('video_assets')
                  .update({ views_count: merged })
                  .eq('id', video.id);

                if (updateError) {
                  serverLogger.error(`[Cron] Failed to update ${video.playback_id}:`, updateError);
                  errorCount++;
                  errors.push(`${video.title}: ${updateError.message}`);
                } else {
                  serverLogger.debug(
                    `[Cron] Updated ${video.title}: ${video.views_count} → ${merged} views (livepeer=${livepeerTotal})`,
                  );
                  updatedCount++;
                  successCount++;
                }
              } else {
                successCount++;
              }
            } else {
              serverLogger.warn(`[Cron] No metrics returned for ${video.playback_id}`);
              errorCount++;
              errors.push(`${video.title}: No metrics returned`);
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            serverLogger.error(`[Cron] Failed to sync ${video.playback_id}:`, err);
            errorCount++;
            errors.push(`${video.title}: ${errorMessage}`);
          }
        })
      );
      
      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < videos.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      totalVideos: videos.length,
      successCount,
      updatedCount,
      errorCount,
      duration: `${(duration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
      errors: errorCount > 0 ? errors.slice(0, 10) : undefined, // Only include first 10 errors
    };

    serverLogger.debug('[Cron] View count sync completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    serverLogger.error('[Cron] Fatal error in cron job:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

