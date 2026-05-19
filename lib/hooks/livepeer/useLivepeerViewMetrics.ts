"use client";

import { skipToken, useQuery } from "@tanstack/react-query";

export interface LivepeerViewMetrics {
  playbackId: string;
  viewCount: number;
  playtimeMins: number;
  legacyViewCount: number;
}

interface UseLivepeerViewMetricsOptions {
  refreshIntervalMs?: number;
}

const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

export function livepeerViewMetricsQueryKey(playbackId: string) {
  return ["livepeer-view-metrics", playbackId] as const;
}

export async function fetchLivepeerViewMetrics(
  playbackId: string,
  signal?: AbortSignal,
): Promise<LivepeerViewMetrics> {
  const response = await fetch(
    `/api/livepeer/views/${encodeURIComponent(playbackId)}?t=${Date.now()}`,
    {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal,
    },
  );

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : "Failed to fetch view metrics";
    throw new Error(message);
  }

  if (!data.success) {
    throw new Error("Failed to fetch view metrics");
  }

  return {
    playbackId: String(data.playbackId ?? playbackId),
    viewCount: Number(data.viewCount ?? 0) || 0,
    playtimeMins: Number(data.playtimeMins ?? 0) || 0,
    legacyViewCount: Number(data.legacyViewCount ?? 0) || 0,
  };
}

/** Shared via React Query so duplicate playbackIds dedupe fetches and polling. */
export function useLivepeerViewMetrics(
  playbackId: string,
  options: UseLivepeerViewMetricsOptions = {},
) {
  const refreshIntervalMs =
    options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;

  const id = playbackId?.trim() ?? "";
  const enabled = id.length > 0;

  const query = useQuery({
    queryKey: livepeerViewMetricsQueryKey(enabled ? id : "__skipped__"),
    queryFn: enabled
      ? ({ signal }) => fetchLivepeerViewMetrics(id, signal)
      : skipToken,
    staleTime: 0,
    refetchInterval:
      enabled && refreshIntervalMs > 0 ? refreshIntervalMs : false,
  });

  const viewMetrics = query.data ?? null;
  const totalViews =
    (viewMetrics?.viewCount ?? 0) + (viewMetrics?.legacyViewCount ?? 0);

  const errorMsg =
    query.error instanceof Error
      ? query.error.message
      : query.error != null
        ? String(query.error)
        : null;

  return {
    viewMetrics,
    totalViews,
    loading: enabled ? query.isPending : false,
    error: errorMsg,
  };
}
