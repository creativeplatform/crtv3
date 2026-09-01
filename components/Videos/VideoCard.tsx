"use client";
import { Button } from "../ui/button";
import { convertFailingGateway } from "@/lib/utils/image-gateway";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { Asset } from "livepeer/models/components";
import Link from "next/link";
import { Src } from "@livepeer/react";
import makeBlockie from "ethereum-blockies-base64";
import VideoViewMetrics from "./VideoViewMetrics";
import { MessageCircle, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchVideoAssetByPlaybackId } from "@/lib/utils/video-assets-client";
import VideoThumbnail from "./VideoThumbnail";
import { ShareDialog } from "./ShareDialog";
import { useCreatorProfile } from "@/lib/hooks/metokens/useCreatorProfile";
import { MembershipVerifiedBadge } from "@/components/User/MembershipVerifiedBadge";
import { VideoBuyButton } from "./VideoBuyButton";
import { logger } from "@/lib/utils/logger";
import { useIsVideoAdmin } from "@/hooks/useIsVideoAdmin";
import { getDetailPlaybackSource } from "@/lib/hooks/livepeer/useDetailPlaybackSources";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useQueryClient } from "@tanstack/react-query";
import { livepeerViewMetricsQueryKey } from "@/lib/hooks/livepeer/useLivepeerViewMetrics";

type DiscoverAssetExtras = {
  thumbnail_url?: string | null;
  thumbnailUri?: string | null;
  videoAssetDbId?: number;
  dbStatus?: "draft" | "published" | "minted" | "archived";
  creator_metoken_id?: string | null;
  attributes?: Record<string, unknown> | null;
  title?: string;
  views_count?: number;
  sourceType?: "Upload" | "Livestream" | "Clip";
};

interface VideoCardProps {
  asset: Asset & DiscoverAssetExtras;
  playbackSources: Src[] | null;
  priority?: boolean;
}

function hasListMetadata(asset: Asset & DiscoverAssetExtras): boolean {
  return (
    asset.videoAssetDbId != null ||
    asset.dbStatus != null ||
    asset.creator_metoken_id != null ||
    asset.attributes?.content_coin_id != null ||
    Boolean(asset.name || asset.title)
  );
}

const VideoCard: React.FC<VideoCardProps> = ({
  asset,
  playbackSources,
  priority = false,
}) => {
  const isVideoAdmin = useIsVideoAdmin();
  const queryClient = useQueryClient();
  const [dbStatus, setDbStatus] = useState<
    "draft" | "published" | "minted" | "archived" | null
  >(() => asset.dbStatus ?? null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const playbackFetchedRef = useRef(false);
  const [lazySrc, setLazySrc] = useState<Src[] | null>(playbackSources);
  const [nearViewport, setNearViewport] = useState(false);
  const [syncedViewsCount, setSyncedViewsCount] = useState<number>(
    () => Math.max(0, Number(asset.views_count) || 0),
  );

  // Reset deferred playback when the card's video changes (pagination / filter)
  useEffect(() => {
    playbackFetchedRef.current = Boolean(playbackSources?.length);
    setLazySrc(playbackSources);
    setNearViewport(false);
    setSyncedViewsCount(Math.max(0, Number(asset.views_count) || 0));
  }, [asset.playbackId, asset.views_count, playbackSources]);

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const rootMargin = isDesktop ? "400px" : "200px";

  const address = asset.creatorId?.value as string;
  const { profile: creatorProfile } = useCreatorProfile(address);

  const [videoAssetId, setVideoAssetId] = useState<number | null>(
    () => asset.videoAssetDbId ?? null,
  );
  const [hasMeToken, setHasMeToken] = useState<boolean>(() =>
    Boolean(asset.creator_metoken_id || asset.attributes?.content_coin_id),
  );
  const [videoTitle, setVideoTitle] = useState<string | null>(
    () => asset.title || asset.name || null,
  );

  const ensurePlaybackSources = useCallback(async () => {
    if (!asset?.playbackId || playbackFetchedRef.current) return;
    if (lazySrc?.length) {
      playbackFetchedRef.current = true;
      return;
    }
    playbackFetchedRef.current = true;
    try {
      const src = await getDetailPlaybackSource(asset.playbackId);
      setLazySrc(src);
    } catch (e) {
      logger.warn("Deferred playback fetch failed:", e);
      playbackFetchedRef.current = false;
    }
  }, [asset?.playbackId, lazySrc?.length]);

  // Near-viewport / prefetch playback
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setNearViewport(true);
            void ensurePlaybackSources();
          }
        }
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ensurePlaybackSources, rootMargin]);

  // Prefer list payload; only hit API when Discover didn't supply metadata
  useEffect(() => {
    if (!asset?.playbackId) {
      setVideoAssetId(null);
      setHasMeToken(false);
      setVideoTitle(null);
      return;
    }

    if (hasListMetadata(asset)) {
      if (asset.videoAssetDbId != null) setVideoAssetId(asset.videoAssetDbId);
      if (asset.dbStatus) setDbStatus(asset.dbStatus);
      setVideoTitle(asset.title || asset.name || null);
      setHasMeToken(
        Boolean(asset.creator_metoken_id || asset.attributes?.content_coin_id),
      );
      return;
    }

    let cancelled = false;
    async function fetchStatus() {
      setVideoAssetId(null);
      setHasMeToken(false);
      setVideoTitle(null);
      try {
        const row = await fetchVideoAssetByPlaybackId(asset.playbackId!);
        if (cancelled) return;
        if (row) {
          if (row.id) setVideoAssetId(row.id);
          if (row?.title) setVideoTitle(row.title);
          if (row?.status) {
            const validStatuses = [
              "draft",
              "published",
              "minted",
              "archived",
            ] as const;
            if (validStatuses.includes(row.status as (typeof validStatuses)[number])) {
              setDbStatus(
                row.status as "draft" | "published" | "minted" | "archived",
              );
            }
          }
          setHasMeToken(
            Boolean(row?.creator_metoken_id || row?.attributes?.content_coin_id),
          );
        }
      } catch (e) {
        if (!cancelled) {
          logger.error("Error fetching video asset:", e);
          setVideoAssetId(null);
          setHasMeToken(false);
          setVideoTitle(null);
        }
      }
    }
    void fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [asset]);

  // View sync only after the card has been near the viewport
  useEffect(() => {
    async function syncViewCount() {
      if (!nearViewport) return;
      if (!asset?.playbackId || (dbStatus !== "published" && dbStatus !== "minted"))
        return;

      const lastSyncKey = `view-sync-${asset.playbackId}`;
      const lastSyncStr = localStorage.getItem(lastSyncKey);
      const now = Date.now();

      if (lastSyncStr) {
        const lastSync = parseInt(lastSyncStr, 10);
        const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);
        if (hoursSinceSync < 1) return;
      }

      try {
        const response = await fetch(
          `/api/video-assets/sync-views/${asset.playbackId}`,
          { method: "GET" },
        );
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            localStorage.setItem(lastSyncKey, now.toString());
            const nextViews = Number(result.viewCount ?? 0);
            if (Number.isFinite(nextViews) && nextViews >= 0) {
              setSyncedViewsCount((prev) => Math.max(prev, nextViews));
            }
            void queryClient.invalidateQueries({
              queryKey: livepeerViewMetricsQueryKey(asset.playbackId!),
            });
          }
        }
      } catch (error) {
        logger.error("Failed to sync view count:", error);
      }
    }

    if (dbStatus === "published" || dbStatus === "minted") {
      void syncViewCount();
    }
  }, [asset?.playbackId, dbStatus, nearViewport, queryClient]);

  if (!asset) {
    logger.warn("VideoCard: No asset provided");
    return null;
  }

  if (asset.status?.phase !== "ready") {
    logger.debug(
      `VideoCard: Asset ${asset.id} not ready, status: ${asset.status?.phase}`,
    );
    return null;
  }

  if (!address) {
    logger.warn(`VideoCard: No creator address for asset ${asset.id}`, asset);
    return null;
  }

  const shortenAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="w-full" ref={cardRef}>
      <Card key={asset?.id} className={cn("w-full overflow-hidden")}>
        <div className="mx-auto flex-1 flex-wrap">
          <CardHeader>
            <Link
              href={`/creator/${address}`}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={
                    creatorProfile?.avatar_url
                      ? convertFailingGateway(creatorProfile.avatar_url)
                      : makeBlockie(address)
                  }
                  alt={creatorProfile?.username || "Creator"}
                  className="h-10 w-10 rounded-full"
                />
                <AvatarFallback>
                  {creatorProfile?.username
                    ? creatorProfile.username.charAt(0).toUpperCase()
                    : address.slice(2, 3).toUpperCase() || "C"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="inline-flex items-center gap-1 text-sm font-medium">
                  {creatorProfile?.username || shortenAddress(address)}
                  <MembershipVerifiedBadge address={address} />
                </span>
              </div>
            </Link>
          </CardHeader>
        </div>
        <Link href={`/discover/${asset.id}`} className="block cursor-pointer">
          <VideoThumbnail
            playbackId={asset.playbackId!}
            src={lazySrc}
            assetId={asset?.id}
            title={asset?.name}
            initialThumbnailUrl={
              asset.thumbnail_url || asset.thumbnailUri || undefined
            }
            enablePreview={true}
            priority={priority}
            onRequestPlayback={() => {
              void ensurePlaybackSources();
            }}
          />
        </Link>
        <CardContent>
          <div className="my-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isVideoAdmin && (
                <>
                  <Badge
                    className={
                      asset.status?.phase === "ready" ? "black" : "white"
                    }
                  >
                    {asset?.status?.phase}
                  </Badge>
                  {dbStatus && <Badge variant="secondary">{dbStatus}</Badge>}
                </>
              )}
              {asset.sourceType === "Livestream" && (
                <Badge variant="outline" className="border-orange-500/50 text-orange-400">
                  Livestream Replay
                </Badge>
              )}
            </div>
            {nearViewport ? (
              <VideoViewMetrics
                playbackId={asset.playbackId || ""}
                fallbackViews={syncedViewsCount}
              />
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
          {videoAssetId && <div className="my-2" />}
          <div className="mt-6 grid grid-flow-row auto-rows-max space-y-3 overflow-hidden">
            <CardTitle>
              <Link href={`/discover/${asset.id}`}>
                <h1
                  className="max-w-full overflow-hidden text-ellipsis 
                whitespace-nowrap text-xl font-bold hover:text-orange-600 focus:text-orange-600"
                >
                  {videoTitle || asset?.name}
                </h1>
              </Link>
            </CardTitle>
          </div>
        </CardContent>
        <hr className="mb-5" />
        <CardFooter className="mx-auto flex items-center justify-center">
          {asset?.status?.phase === "ready" ? (
            <div className="flex space-x-10">
              {hasMeToken && asset?.playbackId && (
                <VideoBuyButton
                  playbackId={asset.playbackId}
                  videoTitle={videoTitle || asset?.name || "Video"}
                  className="flex-1"
                />
              )}
              <Link href={`/discover/${encodeURIComponent(asset?.id)}`}>
                <Button
                  className="flex-1 cursor-pointer hover:scale-125"
                  aria-label={`Comment on ${asset?.name}`}
                  variant="ghost"
                >
                  <MessageCircle className="w-5 h-5" />
                </Button>
              </Link>
              <Button
                className="flex-1 cursor-pointer hover:scale-125"
                aria-label={`Share ${asset?.name}`}
                variant="ghost"
                onClick={() => setIsShareDialogOpen(true)}
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          ) : null}
        </CardFooter>
      </Card>

      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        videoTitle={videoTitle || asset?.name || "Video"}
        videoId={asset?.id || ""}
        playbackId={asset?.playbackId || undefined}
      />
    </div>
  );
};

export default VideoCard;
