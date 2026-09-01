"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { useCreatorWalletAddress } from "@/lib/hooks/accountkit/useCreatorWalletAddress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { convertFailingGateway } from "@/lib/utils/image-gateway";

type CreatorAnalyticsResponse = {
  success: boolean;
  summary: {
    totalViews: number;
    playtimeMins: number;
    videoCount: number;
    likesCount: number;
  };
  timeseries: Array<{
    timestamp: number;
    viewCount: number;
    playtimeMins: number;
  }>;
  videos: Array<{
    playbackId: string;
    title: string;
    thumbnail: string | null;
    views: number;
    playtimeMins: number;
    likes: number;
    assetId: string | null;
  }>;
  livepeerAvailable: boolean;
};

function formatWatchTime(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return "0m";
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = mins / 60;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function ViewsSparkline({
  points,
}: {
  points: CreatorAnalyticsResponse["timeseries"];
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough data for a trend yet.
      </p>
    );
  }

  const max = Math.max(...points.map((p) => p.viewCount), 1);
  const width = 600;
  const height = 80;
  const pad = 4;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = height - pad - (p.viewCount / max) * (height - pad * 2);
    return `${x},${y}`;
  });
  const line = coords.join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-20 w-full text-foreground"
      role="img"
      aria-label="Views over the last 30 days"
    >
      <polygon points={area} className="fill-muted" opacity={0.6} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

async function fetchCreatorAnalytics(
  creatorId: string,
  getAuthHeaders: () => Promise<Record<string, string>>,
): Promise<CreatorAnalyticsResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/livepeer/views/creator?creatorId=${encodeURIComponent(creatorId)}`,
    {
      cache: "no-store",
      headers,
    },
  );

  const data = (await response.json()) as CreatorAnalyticsResponse & {
    error?: string;
  };

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to load analytics");
  }

  return data;
}

export function CreatorAnalyticsTab() {
  const { creatorAddress, isLoading: addressLoading } =
    useCreatorWalletAddress();
  const { getAuthHeaders, address: authAddress } = useWalletAuth();

  const enabled = Boolean(creatorAddress || authAddress);

  const query = useQuery({
    queryKey: ["creator-analytics", creatorAddress ?? authAddress],
    enabled,
    staleTime: 60_000,
    queryFn: () =>
      fetchCreatorAnalytics(
        (creatorAddress || authAddress)!,
        getAuthHeaders,
      ),
  });

  if (addressLoading || (enabled && query.isPending)) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Analytics</CardTitle>
          <CardDescription>Connect your wallet to view analytics.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const summary = query.data?.summary;
  const videos = query.data?.videos ?? [];
  const empty = !query.isError && videos.length === 0;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <CardTitle className="text-2xl">Analytics</CardTitle>
          <span className="text-xs text-muted-foreground">Last 30 days</span>
        </div>
        <CardDescription>
          How your published videos are performing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {query.isError ? (
          <p className="text-sm text-muted-foreground">
            {query.error instanceof Error
              ? query.error.message
              : "Unable to load analytics right now."}
          </p>
        ) : null}

        {empty ? (
          <div className="space-y-4 py-6 text-center">
            <p className="text-muted-foreground">
              Upload a video to see analytics
            </p>
            <Button asChild>
              <Link href="/upload">Upload New Video</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Views
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {(summary?.totalViews ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Watch time
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatWatchTime(summary?.playtimeMins ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Videos
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {(summary?.videoCount ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Likes
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {(summary?.likesCount ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Views over time</p>
              <ViewsSparkline points={query.data?.timeseries ?? []} />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Your videos</p>
              <ul className="divide-y divide-border rounded-md border">
                {videos.map((video) => {
                  const href = video.assetId
                    ? `/discover/${video.assetId}`
                    : `/watch/${video.playbackId}`;
                  const thumb = video.thumbnail
                    ? convertFailingGateway(video.thumbnail)
                    : null;
                  return (
                    <li key={video.playbackId}>
                      <Link
                        href={href}
                        className="flex items-center gap-3 px-3 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-muted">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {video.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {video.views.toLocaleString()} views ·{" "}
                            {formatWatchTime(video.playtimeMins)} ·{" "}
                            {video.likes.toLocaleString()} likes
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
