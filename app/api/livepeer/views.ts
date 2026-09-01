import { serverLogger } from '@/lib/utils/logger';
import { getFullLivepeer } from '@/lib/sdk/livepeer/fullClient';
import {
  hasLivepeerErrors,
  parseLivepeerViewMetricsBody,
  type ParsedViewMetrics,
} from '@/lib/livepeer/parse-view-metrics';
import {
  hasLivepeerPrivateApiKey,
  livepeerStudioApiBaseUrl,
  resolveLivepeerStudioAuthToken,
} from '@/lib/sdk/livepeer/studioAuth';

export {
  livepeerStudioApiBaseUrl,
  resolveLivepeerStudioAuthToken,
} from '@/lib/sdk/livepeer/studioAuth';

/** Bound hung Livepeer Studio requests so views fallback can proceed. */
const LIVEPEER_FETCH_TIMEOUT_MS = 10_000;

function livepeerFetchSignal(): AbortSignal {
  return AbortSignal.timeout(LIVEPEER_FETCH_TIMEOUT_MS);
}

export type LivepeerViewMetrics = {
  playbackId: string;
  viewCount: number;
  playtimeMins: number;
  legacyViewCount: number;
};

export type FetchAllViewsResult =
  | { ok: true; metrics: LivepeerViewMetrics }
  | {
      ok: false;
      reason: 'not_configured' | 'upstream_error' | 'network_error';
      status?: number;
    };

function isSdkAuthFailure(status?: number): boolean {
  return status === 401 || status === 403;
}

function getSdkErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const status = Number(obj.statusCode ?? obj.status);
    if (Number.isFinite(status)) return status;
  }
  if (error instanceof Error) {
    const match = error.message.match(/Status (\d{3})/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function isZeroMetrics(metrics: ParsedViewMetrics): boolean {
  return (
    metrics.viewCount === 0 &&
    metrics.legacyViewCount === 0 &&
    metrics.playtimeMins === 0
  );
}

function toLivepeerViewMetrics(parsed: ParsedViewMetrics): LivepeerViewMetrics {
  return {
    playbackId: parsed.playbackId,
    viewCount: parsed.viewCount,
    playtimeMins: parsed.playtimeMins,
    legacyViewCount: parsed.legacyViewCount,
  };
}

async function livepeerAuthedGet(
  path: string,
  token: string,
): Promise<
  | { ok: true; status: number; rawData: unknown }
  | { ok: false; status: number }
> {
  const myHeaders = new Headers();
  myHeaders.append('Authorization', `Bearer ${token}`);

  const base = livepeerStudioApiBaseUrl();
  const response = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: myHeaders,
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

  return { ok: true, status: response.status, rawData };
}

async function fetchTotalViewsViaHttp(
  playbackId: string,
  token: string,
): Promise<FetchAllViewsResult> {
  const result = await livepeerAuthedGet(
    `/api/data/views/query/total/${encodeURIComponent(playbackId)}`,
    token,
  );

  if (!result.ok) {
    serverLogger.warn(
      `Livepeer total views API ${result.status} for playbackId=${playbackId}`,
    );
    return {
      ok: false,
      reason: 'upstream_error',
      status: result.status,
    };
  }

  const parsed = parseLivepeerViewMetricsBody(result.rawData, playbackId);
  if (!parsed) {
    return {
      ok: false,
      reason: 'upstream_error',
      status: result.status,
    };
  }

  return { ok: true, metrics: toLivepeerViewMetrics(parsed) };
}

/**
 * Public total-views endpoint — works without auth / with CORS keys per Livepeer docs.
 * Used when authenticated metrics are unavailable or empty.
 */
async function fetchPublicTotalViews(
  playbackId: string,
): Promise<FetchAllViewsResult> {
  try {
    const base = livepeerStudioApiBaseUrl();
    const response = await fetch(
      `${base}/api/data/views/query/total/${encodeURIComponent(playbackId)}`,
      {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        signal: livepeerFetchSignal(),
      },
    );

    if (!response.ok) {
      serverLogger.warn(
        `Livepeer public total views API ${response.status} for playbackId=${playbackId}`,
      );
      return {
        ok: false,
        reason: 'upstream_error',
        status: response.status,
      };
    }

    const rawData = await response.json();
    if (hasLivepeerErrors(rawData)) {
      return { ok: false, reason: 'upstream_error', status: response.status };
    }

    const parsed = parseLivepeerViewMetricsBody(rawData, playbackId);
    if (!parsed) {
      return { ok: false, reason: 'upstream_error', status: response.status };
    }

    return { ok: true, metrics: toLivepeerViewMetrics(parsed) };
  } catch (error) {
    serverLogger.warn(
      `Livepeer public total views failed for playbackId=${playbackId}: ${
        error instanceof Error ? error.message : error
      }`,
    );
    return { ok: false, reason: 'network_error' };
  }
}

/** Studio dashboard can show views before the /total endpoint reflects them. */
async function fetchViewershipQueryViaHttp(
  playbackId: string,
  token: string,
): Promise<FetchAllViewsResult> {
  const params = new URLSearchParams({
    playbackId,
    from: new Date(0).toISOString(),
    to: new Date().toISOString(),
  });

  const result = await livepeerAuthedGet(
    `/api/data/views/query?${params.toString()}`,
    token,
  );

  if (!result.ok) {
    serverLogger.warn(
      `Livepeer viewership query API ${result.status} for playbackId=${playbackId}`,
    );
    return {
      ok: false,
      reason: 'upstream_error',
      status: result.status,
    };
  }

  const parsed = parseLivepeerViewMetricsBody(result.rawData, playbackId);
  if (!parsed) {
    return {
      ok: false,
      reason: 'upstream_error',
      status: result.status,
    };
  }

  return { ok: true, metrics: toLivepeerViewMetrics(parsed) };
}

async function fetchAllViewsViaHttp(
  playbackId: string,
  token: string,
): Promise<FetchAllViewsResult> {
  const totalResult = await fetchTotalViewsViaHttp(playbackId, token);

  // Non-zero /total is authoritative.
  if (totalResult.ok && !isZeroMetrics(totalResult.metrics)) {
    return totalResult;
  }

  // Studio can show views before /total catches up; also recover when /total errors.
  const queryResult = await fetchViewershipQueryViaHttp(playbackId, token);
  if (queryResult.ok && !isZeroMetrics(queryResult.metrics)) {
    serverLogger.debug(
      `Livepeer viewership query fallback used for playbackId=${playbackId} (total=${
        totalResult.ok
          ? totalResult.metrics.viewCount + totalResult.metrics.legacyViewCount
          : `error:${totalResult.status ?? totalResult.reason}`
      }, query=${queryResult.metrics.viewCount + queryResult.metrics.legacyViewCount})`,
    );
    return queryResult;
  }

  if (totalResult.ok) return totalResult;
  if (queryResult.ok) return queryResult;
  return totalResult;
}

async function fetchViewsViaSdk(
  playbackId: string,
): Promise<FetchAllViewsResult | null> {
  const client = getFullLivepeer();
  if (!client) return null;

  try {
    const response = await client.metrics.getViewership({
      playbackId,
      from: new Date(0),
      to: new Date(),
    });

    if (response.data) {
      const parsed = parseLivepeerViewMetricsBody(response.data, playbackId);
      if (parsed) {
        return { ok: true, metrics: toLivepeerViewMetrics(parsed) };
      }
    }

    if (response.error) {
      if (isSdkAuthFailure(response.statusCode)) {
        serverLogger.debug(
          `Livepeer SDK getViewership auth rejected for playbackId=${playbackId}, will try HTTP fallback`,
        );
        return null;
      }
      serverLogger.warn(
        `Livepeer SDK getViewership error for playbackId=${playbackId}`,
      );
      return {
        ok: false,
        reason: 'upstream_error',
        status: response.statusCode,
      };
    }
  } catch (error) {
    const status = getSdkErrorStatus(error);
    if (isSdkAuthFailure(status)) {
      serverLogger.debug(
        `Livepeer SDK getViewership auth rejected for playbackId=${playbackId}, will try HTTP fallback`,
      );
      return null;
    }
    serverLogger.warn(
      `Livepeer SDK getViewership failed for playbackId=${playbackId}: ${error instanceof Error ? error.message : error}`,
    );
    return {
      ok: false,
      reason: 'upstream_error',
      status,
    };
  }

  return null;
}

export const fetchAllViews = async (
  playbackId: string,
): Promise<FetchAllViewsResult> => {
  const token = resolveLivepeerStudioAuthToken();

  const sdkResult = token && hasLivepeerPrivateApiKey()
    ? await fetchViewsViaSdk(playbackId)
    : null;
  if (sdkResult?.ok && !isZeroMetrics(sdkResult.metrics)) {
    return sdkResult;
  }
  if (sdkResult && !sdkResult.ok) {
    serverLogger.debug(
      `Livepeer SDK getViewership unavailable (status=${sdkResult.status ?? 'unknown'}), falling back to HTTP for playbackId=${playbackId}`,
    );
  }

  let zeroAuthedResult: FetchAllViewsResult | null =
    sdkResult?.ok && isZeroMetrics(sdkResult.metrics) ? sdkResult : null;

  if (token) {
    try {
      const httpResult = await fetchAllViewsViaHttp(playbackId, token);
      if (httpResult.ok && !isZeroMetrics(httpResult.metrics)) {
        return httpResult;
      }
      if (httpResult.ok) {
        zeroAuthedResult = httpResult;
      }
      // Zero or failed authed metrics: fall through to shared public fallback.
    } catch (error) {
      serverLogger.error('Failed to fetch view metrics:', error);
    }
  } else {
    serverLogger.warn(
      'Livepeer view metrics: no API key; trying public total views endpoint',
    );
  }

  const publicResult = await fetchPublicTotalViews(playbackId);
  if (publicResult.ok && !isZeroMetrics(publicResult.metrics)) {
    serverLogger.debug(
      `Livepeer public total views used for playbackId=${playbackId} (authed total was zero or unavailable)`,
    );
    return publicResult;
  }
  if (publicResult.ok) {
    return publicResult;
  }

  // Public failed — prefer a successful zero authed result over a hard error.
  if (zeroAuthedResult?.ok) {
    return zeroAuthedResult;
  }

  if (!token) {
    return { ok: false, reason: 'not_configured' };
  }

  return publicResult;
};
