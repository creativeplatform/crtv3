"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useInterval } from "@/lib/hooks/useInterval";
import { Player } from "@/components/Player/Player";
import { getDetailPlaybackSource } from "@/lib/hooks/livepeer/useDetailPlaybackSources";
import { getStreamByPlaybackId } from "@/services/streams";
import { LiveChat } from "@/components/Live/LiveChat";
import { ClipCreator } from "@/components/Live/ClipCreator";
import { DigitalTwinOverlay } from "@/components/Live/DigitalTwinOverlay";
import { Src } from "@livepeer/react";
import { useUser } from "@account-kit/react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Slash } from "lucide-react";
import { logger } from '@/lib/utils/logger';


import { MeTokenShareButton } from "@/components/Market/MeTokenShareButton";
import { TokenMarketData } from "@/lib/services/market";

interface WatchClientProps {
  initialMarketData?: TokenMarketData | null;
  tokenInfo?: {
    address: string;
    symbol: string;
    name: string;
  } | null;
  videoTitle?: string;
  storyIpId?: string | null;
  storyIpRegistered?: boolean;
}

type StreamStatus =
  | { kind: "loading" }
  | { kind: "live"; sources: Src[] }
  | { kind: "offline-temporary"; attempts: number }
  | { kind: "offline-permanent" }
  | { kind: "not-found" }
  | { kind: "error"; userMessage: string };

const MAX_OFFLINE_POLL_ATTEMPTS = 20; // 20 × 15s ≈ 5 minutes

function sanitizeStreamError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("abort")) {
      return "Request cancelled.";
    }
  }
  return "We couldn't load this stream. Please try again in a moment.";
}

const STORY_SCAN_IP_BASE = process.env.NEXT_PUBLIC_STORY_NETWORK === "mainnet"
  ? "https://www.storyscan.io"
  : "https://aeneid.storyscan.io";

export default function WatchClient({ initialMarketData, tokenInfo, videoTitle, storyIpId, storyIpRegistered }: WatchClientProps) {
  const params = useParams();
  const playbackId = Array.isArray(params.playbackId)
    ? params.playbackId[0]
    : params.playbackId;

  const user = useUser();
  const [status, setStatus] = useState<StreamStatus>({ kind: "loading" });
  const [streamData, setStreamData] = useState<import("@/services/streams").Stream | null>(null);
  const [jwt, setJwt] = useState<string | undefined>(undefined);
  const [isChecking, setIsChecking] = useState(false);

  const fetchPlaybackSources = useCallback(async (isInitial = false) => {
    if (!playbackId) {
      setStatus({ kind: "error", userMessage: "No playback ID provided." });
      return;
    }

    try {
      if (isInitial) setStatus({ kind: "loading" });
      setIsChecking(true);

      // Parallel fetch: Livepeer sources + our persistent stream metadata.
      // Using allSettled so a DB blip doesn't tank the whole classification.
      const [sourcesResult, streamRecordResult] = await Promise.allSettled([
        getDetailPlaybackSource(playbackId),
        getStreamByPlaybackId(playbackId),
      ]);

      const sources = sourcesResult.status === "fulfilled" ? sourcesResult.value : null;
      const streamRecord = streamRecordResult.status === "fulfilled"
        ? streamRecordResult.value
        : null;

      if (sourcesResult.status === "rejected") {
        logger.error("Playback source fetch failed:", sourcesResult.reason);
      }
      if (streamRecordResult.status === "rejected") {
        logger.error("Stream DB fetch failed:", streamRecordResult.reason);
      }

      if (streamRecord) {
        setStreamData(streamRecord as import("@/services/streams").Stream);
      }

      // Happy path — stream is live.
      if (sources && sources.length > 0) {
        setStatus({ kind: "live", sources });

        try {
          const jwtRes = await fetch("/api/livepeer/sign-jwt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playbackId,
              userAddress: user?.address
            }),
          });

          if (jwtRes.ok) {
            const { token } = await jwtRes.json();
            setJwt(token);
          } else {
            const errData = await jwtRes.json().catch(() => ({}));
            logger.warn("Failed to sign JWT for stream:", errData);
          }
        } catch (jwtErr) {
          logger.error("Error signing JWT:", jwtErr);
        }
        return;
      }

      // No sources — classify.
      if (!streamRecord && !videoTitle) {
        setStatus({ kind: "not-found" });
        return;
      }

      // Stream known to us but currently not live — temporary, escalate after cap.
      setStatus((prev) => {
        const nextAttempts = prev.kind === "offline-temporary" ? prev.attempts + 1 : 1;
        if (nextAttempts >= MAX_OFFLINE_POLL_ATTEMPTS) {
          return { kind: "offline-permanent" };
        }
        return { kind: "offline-temporary", attempts: nextAttempts };
      });
    } catch (err) {
      logger.error("Error fetching playback sources:", err);
      setStatus({ kind: "error", userMessage: sanitizeStreamError(err) });
    } finally {
      setIsChecking(false);
    }
  }, [playbackId, user?.address, videoTitle]);

  // Initial fetch
  useEffect(() => {
    fetchPlaybackSources(true);
  }, [fetchPlaybackSources]);

  // Auto-poll every 15 seconds only while the stream is temporarily offline.
  useInterval(
    useCallback(() => fetchPlaybackSources(false), [fetchPlaybackSources]),
    status.kind === "offline-temporary" ? 15000 : null
  );

  // Generate a consistent sessionId based on playbackId so viewers share the same chat session.
  const sessionId = playbackId ? `session-${playbackId}` : "";
  const streamId = playbackId || "";

  const showThumbnail = !!streamData?.thumbnail_url && status.kind !== "not-found";

  return (
    <div className="min-h-screen p-6">
      <div className="my-5 p-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">
                  <span role="img" aria-label="home">
                    🏠
                  </span>{" "}
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <Slash />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/discover">
                  Discover
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <Slash />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Live Stream</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="max-w-7xl mx-auto">
        {(storyIpRegistered && storyIpId) && (
          <div className="mb-4 p-3 rounded-lg border bg-muted/50">
            <p className="text-sm font-medium text-muted-foreground">Registered as IP Asset</p>
            <p className="text-xs font-mono mt-1 truncate" title={storyIpId}>{storyIpId}</p>
            <a
              href={`${STORY_SCAN_IP_BASE}/ip/${storyIpId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              View on Story Protocol →
            </a>
          </div>
        )}
        {tokenInfo && (
          <div className="flex justify-end mb-4">
            <MeTokenShareButton
              address={tokenInfo.address}
              symbol={tokenInfo.symbol}
              name={tokenInfo.name}
              type="content"
              playbackId={playbackId as string}
            />
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player Section */}
          <div className="lg:col-span-2 relative">
            {streamData?.creator_id && (
              <DigitalTwinOverlay creatorAddress={streamData.creator_id} />
            )}
            {status.kind === "loading" && (
              <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            )}

            {status.kind === "live" && (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <Player
                  src={status.sources}
                  title={videoTitle || streamData?.name || "Live Stream"}
                  jwt={jwt}
                />
              </div>
            )}

            {status.kind === "offline-temporary" && (
              <FallbackShell showThumbnail={showThumbnail} thumbnailUrl={streamData?.thumbnail_url}>
                <AlertCircle className="h-10 w-10 text-gray-400" />
                <h3 className="text-xl font-bold text-white">Stream is Offline</h3>
                <p className="text-gray-300">The broadcaster will be back soon.</p>
                <p className="text-xs text-gray-500 mt-1">Auto-checking every 15 seconds...</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <button
                    onClick={() => fetchPlaybackSources(false)}
                    disabled={isChecking}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors font-medium border border-white/20 disabled:opacity-50"
                  >
                    {isChecking ? "Checking..." : "Check Now"}
                  </button>
                  <Link
                    href="/discover"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors font-medium border border-white/20"
                  >
                    Browse Live Streams
                  </Link>
                </div>
              </FallbackShell>
            )}

            {status.kind === "offline-permanent" && (
              <FallbackShell showThumbnail={showThumbnail} thumbnailUrl={streamData?.thumbnail_url}>
                <AlertCircle className="h-10 w-10 text-gray-400" />
                <h3 className="text-xl font-bold text-white">Stream has ended</h3>
                <p className="text-gray-300">This broadcast is no longer live.</p>
                <p className="text-xs text-gray-500 mt-1">Catch the next one on Discover.</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <Link
                    href="/discover"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors font-medium border border-white/20"
                  >
                    Browse Live Streams
                  </Link>
                </div>
              </FallbackShell>
            )}

            {status.kind === "not-found" && (
              <FallbackShell showThumbnail={false}>
                <AlertCircle className="h-10 w-10 text-gray-400" />
                <h3 className="text-xl font-bold text-white">Stream not found</h3>
                <p className="text-gray-300">This link may be incorrect or the stream was removed.</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <Link
                    href="/"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors font-medium border border-white/20"
                  >
                    Back to Home
                  </Link>
                  <Link
                    href="/discover"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors font-medium border border-white/20"
                  >
                    Browse Live Streams
                  </Link>
                </div>
              </FallbackShell>
            )}

            {status.kind === "error" && (
              <FallbackShell showThumbnail={showThumbnail} thumbnailUrl={streamData?.thumbnail_url}>
                <AlertCircle className="h-10 w-10 text-red-400" />
                <h3 className="text-xl font-bold text-white">Unable to load stream</h3>
                <p className="text-gray-300">{status.userMessage}</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <button
                    onClick={() => fetchPlaybackSources(true)}
                    disabled={isChecking}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors font-medium border border-white/20 disabled:opacity-50"
                  >
                    {isChecking ? "Trying..." : "Try again"}
                  </button>
                  <Link
                    href="/discover"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors font-medium border border-white/20"
                  >
                    Browse Live Streams
                  </Link>
                </div>
              </FallbackShell>
            )}
          </div>

          {/* Live Chat Section */}
          <div className="lg:col-span-1">
            {playbackId && sessionId ? (
              <LiveChat
                streamId={streamId}
                sessionId={sessionId}
                creatorAddress={null}
              />
            ) : (
              <div className="border rounded-lg p-4 text-sm text-muted-foreground">
                Loading chat...
              </div>
            )}
          </div>
        </div>

        {/* Clip Creator Section - Below video and chat for viewers */}
        {playbackId && sessionId && (
          <div className="mt-6">
            <ClipCreator
              playbackId={playbackId}
              sessionId={sessionId}
              allowClipping={streamData?.allow_clipping ?? true}
              parentStoryIpId={streamData?.story_ip_id ?? storyIpId ?? null}
              parentCommercialRevShare={streamData?.story_commercial_rev_share ?? null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FallbackShell({
  children,
  showThumbnail,
  thumbnailUrl,
}: {
  children: ReactNode;
  showThumbnail: boolean;
  thumbnailUrl?: string | null;
}) {
  return (
    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden flex flex-col items-center justify-center relative">
      {showThumbnail && thumbnailUrl && (
        <div className="absolute inset-0 z-0 opacity-50">
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="z-10 flex flex-col items-center gap-2 p-6 bg-black/60 rounded-xl backdrop-blur-sm text-center max-w-md">
        {children}
      </div>
    </div>
  );
}
