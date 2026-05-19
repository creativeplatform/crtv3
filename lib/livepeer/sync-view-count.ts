import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeViewCounts } from '@/lib/livepeer/view-count';

export async function getStoredViewsCount(
  supabase: SupabaseClient,
  playbackId: string,
): Promise<number> {
  const { data } = await supabase
    .from('video_assets')
    .select('views_count')
    .eq('playback_id', playbackId)
    .maybeSingle();

  return data?.views_count ?? 0;
}

/**
 * Persists max(stored, livepeer) for a playback id. Never decreases views_count.
 */
export async function syncStoredViewsCount(
  supabase: SupabaseClient,
  playbackId: string,
  livepeerTotal: number,
): Promise<{ viewCount: number; updated: boolean }> {
  const stored = await getStoredViewsCount(supabase, playbackId);
  const merged = mergeViewCounts(stored, livepeerTotal);

  if (merged !== stored) {
    const { error } = await supabase
      .from('video_assets')
      .update({ views_count: merged })
      .eq('playback_id', playbackId);

    if (error) {
      throw error;
    }

    return { viewCount: merged, updated: true };
  }

  return { viewCount: merged, updated: false };
}
