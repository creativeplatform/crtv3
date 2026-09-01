import {
  hasLivepeerErrors,
  parseLivepeerViewMetricsBody,
} from '@/lib/livepeer/parse-view-metrics';
import { mergeViewCounts } from '@/lib/livepeer/view-count';
import {
  livepeerStudioApiBaseUrl,
  resolveLivepeerStudioAuthToken,
} from '@/lib/sdk/livepeer/studioAuth';
import { serverLogger } from '@/lib/utils/logger';

const LIVEPEER_FETCH_TIMEOUT_MS = 10_000;

export type CreatorAnalyticsVideo = {
  playbackId: string;
  title: string;
  thumbnail: string | null;
  views: number;
  playtimeMins: number;
  likes: number;
  assetId: string | null;
};

export type CreatorAnalyticsTimeseriesPoint = {
  timestamp: number;
  viewCount: number;
  playtimeMins: number;
};

export type CreatorAnalyticsSummary = {
  totalViews: number;
  playtimeMins: number;
  videoCount: number;
  likesCount: number;
};

export type CreatorAnalyticsResult = {
  summary: CreatorAnalyticsSummary;
  timeseries: CreatorAnalyticsTimeseriesPoint[];
  videos: CreatorAnalyticsVideo[];
  livepeerAvailable: boolean;
};

export type CreatorDbVideo = {
  playback_id: string;
  title: string | null;
  thumbnailUri?: string | null;
  thumbnail_url?: string | null;
  views_count: number | null;
  likes_count: number | null;
  asset_id: string | null;
};

type LivepeerMetricRow = {
  playbackId?: string;
  timestamp?: number;
  viewCount?: number;
  playtimeMins?: number;
  legacyViewCount?: number;
};

function livepeerFetchSignal(): AbortSignal {
  return AbortSignal.timeout(LIVEPEER_FETCH_TIMEOUT_MS);
}

async function livepeerAuthedGet(
  path: string,
  token: string,
): Promise<{ ok: true; rawData: unknown } | { ok: false; status: number }> {
  const response = await fetch(`${livepeerStudioApiBaseUrl()}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
    cache: 'no-store',
    signal: livepeerFetchSignal(),
  });

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const rawData = await response.json();
  if (hasLivepeerErrors(rawData)) {
    return { ok: false, status: response.status };
  }

  return { ok: true, rawData };
}

function unwrapMetricsArray(rawData: unknown): LivepeerMetricRow[] {
  if (rawData == null) return [];

  if (
    typeof rawData === 'object' &&
    'data' in rawData &&
    (rawData as { data?: unknown }).data != null
  ) {
    return unwrapMetricsArray((rawData as { data: unknown }).data);
  }

  if (Array.isArray(rawData)) {
    return rawData.filter(
      (item): item is LivepeerMetricRow =>
        item != null && typeof item === 'object',
    );
  }

  if (typeof rawData === 'object') {
    return [rawData as LivepeerMetricRow];
  }

  return [];
}

/** Query Livepeer viewership for a creator wallet (uploads tagged with creatorId). */
export async function fetchCreatorLivepeerMetrics(params: {
  creatorId: string;
  from: Date;
  to: Date;
  timeStep?: 'hour' | 'day' | 'week' | 'month' | 'year';
}): Promise<{
  byPlayback: Map<string, { viewCount: number; playtimeMins: number }>;
  timeseries: CreatorAnalyticsTimeseriesPoint[];
  available: boolean;
}> {
  const token = resolveLivepeerStudioAuthToken();
  const empty = {
    byPlayback: new Map<string, { viewCount: number; playtimeMins: number }>(),
    timeseries: [] as CreatorAnalyticsTimeseriesPoint[],
    available: false,
  };

  if (!token) return empty;

  const creatorId = params.creatorId;
  const from = params.from.toISOString();
  const to = params.to.toISOString();
  const timeStep = params.timeStep ?? 'day';

  try {
    const [byPlaybackRes, timeseriesRes] = await Promise.all([
      livepeerAuthedGet(
        `/api/data/views/query?${new URLSearchParams({
          creatorId,
          from,
          to,
        }).toString()}&breakdownBy[]=playbackId`,
        token,
      ),
      livepeerAuthedGet(
        `/api/data/views/query?${new URLSearchParams({
          creatorId,
          from,
          to,
          timeStep,
        }).toString()}`,
        token,
      ),
    ]);

    const byPlayback = new Map<
      string,
      { viewCount: number; playtimeMins: number }
    >();

    if (byPlaybackRes.ok) {
      for (const row of unwrapMetricsArray(byPlaybackRes.rawData)) {
        const playbackId = row.playbackId?.trim();
        if (!playbackId) continue;
        const viewCount =
          (Number(row.viewCount) || 0) + (Number(row.legacyViewCount) || 0);
        const playtimeMins = Number(row.playtimeMins) || 0;
        const prev = byPlayback.get(playbackId) ?? {
          viewCount: 0,
          playtimeMins: 0,
        };
        byPlayback.set(playbackId, {
          viewCount: prev.viewCount + viewCount,
          playtimeMins: prev.playtimeMins + playtimeMins,
        });
      }
    }

    const timeseriesMap = new Map<number, CreatorAnalyticsTimeseriesPoint>();
    if (timeseriesRes.ok) {
      for (const row of unwrapMetricsArray(timeseriesRes.rawData)) {
        const timestamp = Number(row.timestamp);
        if (!Number.isFinite(timestamp)) continue;
        const viewCount =
          (Number(row.viewCount) || 0) + (Number(row.legacyViewCount) || 0);
        const playtimeMins = Number(row.playtimeMins) || 0;
        const prev = timeseriesMap.get(timestamp) ?? {
          timestamp,
          viewCount: 0,
          playtimeMins: 0,
        };
        timeseriesMap.set(timestamp, {
          timestamp,
          viewCount: prev.viewCount + viewCount,
          playtimeMins: prev.playtimeMins + playtimeMins,
        });
      }
    }

    // If breakdown query failed but a single aggregate came back, still mark available.
    const available = byPlaybackRes.ok || timeseriesRes.ok;
    if (!available) {
      serverLogger.warn(
        `Creator Livepeer metrics unavailable for ${creatorId} (playback=${
          byPlaybackRes.ok ? 'ok' : byPlaybackRes.status
        }, series=${timeseriesRes.ok ? 'ok' : timeseriesRes.status})`,
      );
    }

    return {
      byPlayback,
      timeseries: [...timeseriesMap.values()].sort(
        (a, b) => a.timestamp - b.timestamp,
      ),
      available,
    };
  } catch (error) {
    serverLogger.warn(
      `Creator Livepeer metrics failed for ${creatorId}: ${
        error instanceof Error ? error.message : error
      }`,
    );
    return empty;
  }
}

export function mergeCreatorAnalytics(params: {
  dbVideos: CreatorDbVideo[];
  livepeerByPlayback: Map<string, { viewCount: number; playtimeMins: number }>;
  timeseries: CreatorAnalyticsTimeseriesPoint[];
  livepeerAvailable: boolean;
}): CreatorAnalyticsResult {
  const videos: CreatorAnalyticsVideo[] = params.dbVideos
    .filter((v) => Boolean(v.playback_id?.trim()))
    .map((v) => {
      const playbackId = v.playback_id;
      const lp = params.livepeerByPlayback.get(playbackId);
      const dbViews = Number(v.views_count) || 0;
      const livepeerViews = lp?.viewCount ?? 0;
      return {
        playbackId,
        title: v.title?.trim() || 'Untitled',
        thumbnail: v.thumbnail_url || v.thumbnailUri || null,
        views: mergeViewCounts(dbViews, livepeerViews),
        playtimeMins: lp?.playtimeMins ?? 0,
        likes: Number(v.likes_count) || 0,
        assetId: v.asset_id,
      };
    })
    .sort((a, b) => b.views - a.views);

  // Include Livepeer-only playbacks not yet in DB (rare, but keep Studio parity).
  for (const [playbackId, lp] of params.livepeerByPlayback) {
    if (videos.some((v) => v.playbackId === playbackId)) continue;
    videos.push({
      playbackId,
      title: playbackId,
      thumbnail: null,
      views: lp.viewCount,
      playtimeMins: lp.playtimeMins,
      likes: 0,
      assetId: null,
    });
  }
  videos.sort((a, b) => b.views - a.views);

  const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
  const playtimeMins = videos.reduce((sum, v) => sum + v.playtimeMins, 0);
  const likesCount = videos.reduce((sum, v) => sum + v.likes, 0);

  return {
    summary: {
      totalViews,
      playtimeMins,
      videoCount: videos.length,
      likesCount,
    },
    timeseries: params.timeseries,
    videos,
    livepeerAvailable: params.livepeerAvailable,
  };
}

/** Re-export parser helper for tests that need to assert zero metrics shape. */
export function parseCreatorMetricSample(
  rawData: unknown,
  playbackId: string,
) {
  return parseLivepeerViewMetricsBody(rawData, playbackId);
}
