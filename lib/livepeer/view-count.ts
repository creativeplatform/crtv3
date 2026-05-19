/**
 * Merge stored and Livepeer view counts without decreasing stored values.
 * Used by read and sync routes so cron/API misreads cannot zero out history.
 */
export function mergeViewCounts(stored: number, livepeer: number): number {
  return Math.max(stored ?? 0, livepeer ?? 0);
}

export function sumLivepeerViewMetrics(metrics: {
  viewCount?: number;
  legacyViewCount?: number;
}): number {
  return (metrics.viewCount ?? 0) + (metrics.legacyViewCount ?? 0);
}

export type ViewCountSource = 'livepeer' | 'database' | 'merged';

export function resolveViewCountSource(
  livepeerTotal: number,
  dbViewCount: number,
): ViewCountSource {
  if (livepeerTotal > 0 && dbViewCount > 0 && livepeerTotal !== dbViewCount) {
    return 'merged';
  }
  if (livepeerTotal > 0 && livepeerTotal >= dbViewCount) return 'livepeer';
  if (dbViewCount > 0) return 'database';
  return 'merged';
}
