"use client";

import React, { useState, useEffect, useRef, forwardRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronDownIcon,
  XIcon,
  PictureInPictureIcon,
  ShieldCheck,
} from "lucide-react";
import { Src } from "@livepeer/react";
import * as Popover from "@radix-ui/react-popover";

import { useUser, useAuthModal } from "@/lib/wallet/react";
import { userToAccount } from "@/lib/types/account";

import {
  PauseIcon,
  PlayIcon,
  MuteIcon,
  SettingsIcon,
  UnmuteIcon,
  LoadingIcon,
  EnterFullscreenIcon,
  ExitFullscreenIcon,
} from "@livepeer/react/assets";
import * as Player from "@livepeer/react/player";
import { Asset } from "livepeer/models/components";

import { cn } from "@/lib/utils";
import {
  SubtitlesDisplay,
  SubtitlesControl,
  SubtitlesProvider,
  SubtitlesLanguageSelect,
  useSubtitles,
} from "@/components/Player/Subtitles";
import { getDetailPlaybackSource } from "@/lib/hooks/livepeer/useDetailPlaybackSources";
import {
  livepeerViewMetricsQueryKey,
  type LivepeerViewMetrics,
} from "@/lib/hooks/livepeer/useLivepeerViewMetrics";
import { generateAccessKey, WebhookContext } from "@/lib/access-key";
import { Skeleton } from "../ui/skeleton";
import { Badge } from "../ui/badge";
import { useIsVideoAdmin } from "@/hooks/useIsVideoAdmin";
import { Button } from "../ui/button";
import { fetchVideoAssetByPlaybackId } from "@/lib/utils/video-assets-client";
import { getThumbnailUrl } from "@/lib/utils/thumbnail";
import { convertFailingGateway } from "@/lib/utils/image-gateway";
import Link from "next/link";
import { LicensePurchaseDialog } from "@/components/Videos/LicensePurchaseDialog";
import { CreatorDisplay } from "@/components/Creator/CreatorDisplay";
import { CreativeBrandOverlay } from "@/components/Player/CreativeBrandOverlay";
import {
  ShoppableOverlay,
  type ShoppableAnnotation,
} from "@/components/Player/ShoppableOverlay";
import { useShoppableAnnotations } from "@/lib/hooks/shoppable/useShoppableAnnotations";

const STORY_SCAN_IP_BASE =
  process.env.NEXT_PUBLIC_STORY_NETWORK === "mainnet"
    ? "https://www.storyscan.io"
    : "https://aeneid.storyscan.io";

const STORY_DISPUTE_DOCS_URL = "https://docs.story.foundation/concepts/dispute-module/overview";

function StoryIPBlock({
  storyIpId,
  storyScanBase,
  licenseTermsId,
  videoTitle,
}: {
  storyIpId: string;
  storyScanBase: string;
  licenseTermsId?: string | null;
  videoTitle?: string;
}) {
  const [attestationStatus, setAttestationStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [infringementSummary, setInfringementSummary] = useState<string | null>(null);
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);

  useEffect(() => {
    if (!storyIpId) return;
    let cancelled = false;
    setAttestationStatus("loading");
    fetch(`/api/story/ip-status?ipId=${encodeURIComponent(storyIpId)}`)
      .then((res) => {
        if (cancelled) return res;
        if (!res.ok) {
          setAttestationStatus("error");
          return null;
        }
        return res.json();
      })
      .then((data: { infringementStatus?: Array<{ status: string; isInfringing: boolean; providerName: string }> | null }) => {
        if (cancelled || !data) return;
        setAttestationStatus("ok");
        const statuses = data.infringementStatus;
        if (!statuses?.length) {
          setInfringementSummary("No infringement detected");
          return;
        }
        const infringing = statuses.filter((s) => s.isInfringing);
        if (infringing.length > 0) {
          setInfringementSummary(`Flagged (${infringing.map((s) => s.providerName).join(", ")})`);
        } else {
          const underReview = statuses.some((s) => (s.status || "").toLowerCase().includes("review"));
          setInfringementSummary(underReview ? "Under review" : "No infringement detected");
        }
      })
      .catch(() => {
        if (!cancelled) setAttestationStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [storyIpId]);

  return (
    <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        Registered as IP Asset
      </p>
      <p
        className="text-xs font-mono truncate text-muted-foreground"
        title={storyIpId}
      >
        {storyIpId}
      </p>
      {attestationStatus === "ok" && infringementSummary && (
        <p className="text-xs text-muted-foreground">
          Attestation: {infringementSummary}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <a
          href={`${storyScanBase}/ip/${storyIpId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          View on Story Protocol →
        </a>
        {licenseTermsId ? (
          <>
            <button
              type="button"
              onClick={() => setLicenseDialogOpen(true)}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Buy License →
            </button>
            <LicensePurchaseDialog
              ipId={storyIpId}
              licenseTermsId={licenseTermsId}
              videoTitle={videoTitle ?? ""}
              open={licenseDialogOpen}
              onOpenChange={setLicenseDialogOpen}
            />
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            Contact creator for licensing
          </span>
        )}
        <a
          href={STORY_DISPUTE_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Report infringement →
        </a>
      </div>
    </div>
  );
}

type VideoDetailsProps = {
  asset: Asset;
  videoTitle?: string;
  /** Creator wallet — shown below the title. */
  creatorAddress?: string | null;
  /** When set, shows a "Verifiable" badge (Livepeer creator attestation). */
  livepeerAttestationId?: string | null;
  /** Story Protocol: when true and storyIpId is set, shows "Registered as IP" block with View/Purchase CTAs. */
  storyIpRegistered?: boolean;
  storyIpId?: string | null;
  /** Story Protocol license terms ID — when set, enables "Buy License" button. */
  storyLicenseTermsId?: string | null;
  /** Optional: NFT contract and token ID for Story/IP links. */
  contractAddress?: string | null;
  tokenId?: string | null;
};

export default function VideoDetails({
  asset,
  videoTitle,
  creatorAddress,
  livepeerAttestationId,
  storyIpRegistered,
  storyIpId,
  storyLicenseTermsId,
  contractAddress,
  tokenId,
}: VideoDetailsProps) {
  const isVideoAdmin = useIsVideoAdmin();
  const [playbackSources, setPlaybackSources] = useState<Src[] | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [conditionalProps, setConditionalProps] = useState<any>({});
  const [dbStatus, setDbStatus] = useState<"draft" | "published" | "minted" | "archived" | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const user = useUser();
  const account = useMemo(() => userToAccount(user), [user]);
  const { openAuthModal } = useAuthModal();
  const isConnected = !!user;

  const { annotations: shoppableAnnotations, campaignId: shoppableCampaignId } =
    useShoppableAnnotations(asset?.playbackId);
  const [activeShoppable, setActiveShoppable] = useState<ShoppableAnnotation[]>(
    []
  );
  const activeShoppableIdsRef = useRef<Set<string>>(new Set());
  const shoppableTickRef = useRef(0);

  const shoppableMap = useMemo(() => {
    const map = new Map<number, ShoppableAnnotation[]>();
    for (const a of shoppableAnnotations) {
      const start = Math.floor(a.startTime);
      const end = Math.floor(a.endTime);
      for (let s = start; s <= end; s++) {
        if (!map.has(s)) map.set(s, []);
        map.get(s)!.push(a);
      }
    }
    return map;
  }, [shoppableAnnotations]);

  const handleShoppableTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!shoppableAnnotations.length || !shoppableCampaignId) return;
      const now = performance.now();
      if (now - shoppableTickRef.current < 250) return;
      shoppableTickRef.current = now;
      const currentTime = e.currentTarget.currentTime;
      const candidates = shoppableMap.get(Math.floor(currentTime)) || [];
      const nextActive = candidates.filter(
        (a) => currentTime >= a.startTime && currentTime <= a.endTime
      );
      const nextIds = new Set(nextActive.map((a) => a.id));
      const currentIds = activeShoppableIdsRef.current;
      if (
        nextIds.size !== currentIds.size ||
        ![...nextIds].every((id) => currentIds.has(id))
      ) {
        activeShoppableIdsRef.current = nextIds;
        setActiveShoppable(nextActive);
      }
    },
    [shoppableAnnotations, shoppableCampaignId, shoppableMap]
  );

  useEffect(() => {
    // Player (and containerRef) only mount when wallet is connected
    if (!isConnected || !asset?.playbackId || !playbackSources?.length) return;

    let cancelled = false;
    let incrementing = false;
    let incremented = false;
    let attachedVideo: HTMLVideoElement | null = null;
    let observer: MutationObserver | null = null;
    let rafId = 0;
    let rafAttempts = 0;
    const MAX_RAF_ATTEMPTS = 120; // ~2s at 60fps, then stop

    const handlePlay = async () => {
      if (incremented || incrementing || !asset.playbackId) return;
      incrementing = true;

      try {
        const response = await fetch(
          `/api/video-assets/views/increment/${encodeURIComponent(asset.playbackId)}`,
          { method: "POST" },
        );
        let payload: { viewCount?: unknown; code?: unknown } | null = null;
        try {
          payload = (await response.json()) as {
            viewCount?: unknown;
            code?: unknown;
          };
        } catch {
          payload = null;
        }

        // DB mutates before the response — treat any 2xx as consumed so we don't double-count
        if (response.ok) {
          incremented = true;
          const viewCount = Number(payload?.viewCount);
          if (Number.isFinite(viewCount) && viewCount > 0) {
            // Keep optimistic DB count for this session; do not invalidate Livepeer
            // metrics (refetch often returns a stale lower total and wipes the bump).
            queryClient.setQueryData<LivepeerViewMetrics>(
              livepeerViewMetricsQueryKey(asset.playbackId),
              (prev) => ({
                playbackId: asset.playbackId!,
                viewCount,
                playtimeMins: prev?.playtimeMins ?? 0,
                legacyViewCount: prev?.legacyViewCount ?? 0,
                totalViews: Math.max(viewCount, prev?.totalViews ?? 0),
              }),
            );
          }
        } else {
          console.warn("Failed to increment views:", {
            status: response.status,
            code: payload?.code ?? null,
          });
        }
      } catch (err) {
        console.error("Failed to increment views:", err);
      } finally {
        incrementing = false;
      }
    };

    const attach = (video: HTMLVideoElement) => {
      if (attachedVideo === video) return;
      if (attachedVideo) {
        attachedVideo.removeEventListener("play", handlePlay);
      }
      attachedVideo = video;
      video.addEventListener("play", handlePlay);
    };

    const setup = () => {
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) {
        rafAttempts += 1;
        if (rafAttempts < MAX_RAF_ATTEMPTS) {
          rafId = requestAnimationFrame(setup);
        }
        return;
      }

      // Player may mount after this effect — observe until <video> exists
      const existing = container.querySelector("video");
      if (existing) attach(existing);

      observer = new MutationObserver(() => {
        const video = container.querySelector("video");
        if (video) attach(video);
      });
      observer.observe(container, { childList: true, subtree: true });
    };

    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      if (attachedVideo) {
        attachedVideo.removeEventListener("play", handlePlay);
      }
    };
  }, [isConnected, asset?.playbackId, playbackSources, queryClient]);

  const loadPlaybackSources = useCallback(async () => {
    if (!asset?.playbackId) {
      setSourcesLoading(false);
      setSourcesError("No playback ID available.");
      setPlaybackSources(null);
      return;
    }

    setSourcesLoading(true);
    setSourcesError(null);
    setPlaybackSources(null);

    try {
      const sources = await getDetailPlaybackSource(asset.playbackId);
      if (!sources?.length) {
        setSourcesError("Unable to load playback sources.");
        setPlaybackSources(null);
      } else {
        setPlaybackSources(sources);
      }
    } catch {
      setSourcesError("Unable to load playback sources.");
      setPlaybackSources(null);
    } finally {
      setSourcesLoading(false);
    }
  }, [asset?.playbackId]);

  useEffect(() => {
    const fetchDbStatus = async () => {
      try {
        if (!asset?.playbackId) return;
        const row = await fetchVideoAssetByPlaybackId(asset.playbackId);
        if (row) {
          if (row?.status) {
            const validStatuses = ["draft", "published", "minted", "archived"] as const;
            if (validStatuses.includes(row.status as any)) {
              setDbStatus(row.status as "draft" | "published" | "minted" | "archived");
            }
          }
        }
      } catch { }
    };
    const fetchThumbnail = async () => {
      if (!asset?.playbackId) return;

      try {
        // First, try to get thumbnail from database
        const row = await fetchVideoAssetByPlaybackId(asset.playbackId);
        if (row && (row as any).thumbnail_url && (row as any).thumbnail_url.trim() !== "") {
          const convertedUrl = convertFailingGateway((row as any).thumbnail_url);
          setThumbnailUrl(convertedUrl);
          return;
        }
      } catch (error) {
        // Silently fail - database thumbnail is optional
      }

      try {
        // If no database thumbnail, try Livepeer VTT thumbnails
        const url = await getThumbnailUrl(asset.playbackId);
        if (url) {
          const convertedUrl = convertFailingGateway(url);
          setThumbnailUrl(convertedUrl);
        } else {
          // Fallback to default thumbnail if no thumbnail found
          setThumbnailUrl("/Creative_TV.png");
        }
      } catch (error) {
        // Silently fail - thumbnail is optional, video will still play
        // Fallback to default thumbnail on error
        setThumbnailUrl("/Creative_TV.png");
      }
    };
    void loadPlaybackSources();
    fetchDbStatus();
    // Wrap in try-catch to prevent unhandled promise rejection
    fetchThumbnail().catch(() => {
      // Silently handle - thumbnail is optional
    });
    const conProps: Record<string, unknown> = {
      ...(asset.playbackPolicy && {
        accessKey: generateAccessKey(
          account?.address,
          asset.playbackPolicy.webhookContext as WebhookContext
        ),
      }),
    };
    setConditionalProps((prev: Record<string, unknown>) => {
      if (
        Object.keys(prev).length === Object.keys(conProps).length &&
        Object.keys(prev).every((key) => prev[key] === conProps[key])
      )
        return prev;
      return conProps;
    });
  }, [account, asset, loadPlaybackSources]);

  const Seek = forwardRef<HTMLButtonElement, Player.SeekProps>(
    ({ children, ...props }, forwardedRef) => (
      <Player.Seek ref={forwardedRef} {...props}>
        <Player.Track
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            position: "relative",
            flexGrow: 1,
            borderRadius: 9999,
            height: 2,
          }}
        >
          <Player.SeekBuffer
            style={{
              position: "absolute",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              borderRadius: 9999,
              height: "100%",
            }}
          />
          <Player.Range
            style={{
              position: "absolute",
              backgroundColor: "white",
              borderRadius: 9999,
              height: "100%",
            }}
          />
        </Player.Track>
        <Player.Thumb
          style={{
            display: "block",
            width: 12,
            height: 12,
            backgroundColor: "#EC407A",
            borderRadius: 9999,
          }}
        />
      </Player.Seek>
    )
  );
  Seek.displayName = "Seek";

  const Settings = React.forwardRef(
    (
      { className }: { className?: string },
      ref: React.Ref<HTMLButtonElement> | undefined
    ) => {
      const { subtitles } = useSubtitles();
      return (
        <Popover.Root>
          <Popover.Trigger ref={ref} asChild>
            <button
              type="button"
              className={className}
              aria-label="Playback settings"
              onClick={(e) => e.stopPropagation()}
            >
              <SettingsIcon />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="bg-gray/50 w-60 rounded-md border border-white/50 p-3 shadow-md z-50
              outline-none backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 
              data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 
              data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
              side="top"
              alignOffset={-70}
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-2">
                <p className="mb-1 text-sm font-medium text-white/90">
                  Settings
                </p>
                <Player.LiveIndicator
                  matcher={false}
                  className="flex flex-col gap-2"
                >
                  <label
                    className="text-xs font-medium text-white/90"
                    htmlFor="speedSelect"
                  >
                    Playback speed
                  </label>
                  <Player.RateSelect name="speedSelect">
                    <Player.SelectTrigger
                      id="speedSelect"
                      className="inline-flex h-7 items-center justify-between gap-1 rounded-sm bg-gray-400 px-1 
                      text-xs leading-none outline-none outline-1 outline-white/50"
                      aria-label="Playback speed"
                    >
                      <Player.SelectValue placeholder="Select a speed..." />
                      <Player.SelectIcon>
                        <ChevronDownIcon className="h-4 w-4" />
                      </Player.SelectIcon>
                    </Player.SelectTrigger>
                    <Player.SelectPortal>
                      <Player.SelectContent className="overflow-hidden rounded-sm bg-gray-400 z-[60]">
                        <Player.SelectViewport className="p-1">
                          <Player.SelectGroup className="">
                            <RateSelectItem value={0.5}>0.5x</RateSelectItem>
                            <RateSelectItem value={0.75}>0.75x</RateSelectItem>
                            <RateSelectItem value={1}>
                              1x (normal)
                            </RateSelectItem>
                            <RateSelectItem value={1.25}>1.25x</RateSelectItem>
                            <RateSelectItem value={1.5}>1.5x</RateSelectItem>
                            <RateSelectItem value={1.75}>1.75x</RateSelectItem>
                            <RateSelectItem value={2}>2x</RateSelectItem>
                          </Player.SelectGroup>
                        </Player.SelectViewport>
                      </Player.SelectContent>
                    </Player.SelectPortal>
                  </Player.RateSelect>
                </Player.LiveIndicator>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-medium text-white/90"
                    htmlFor="qualitySelect"
                  >
                    Quality
                  </label>
                  <Player.VideoQualitySelect
                    name="qualitySelect"
                    defaultValue="1.0"
                  >
                    <Player.SelectTrigger
                      id="qualitySelect"
                      className="inline-flex h-7 items-center justify-between gap-1 rounded-sm  bg-gray-400 px-1 
                      text-xs leading-none outline-none outline-1 outline-white/50"
                      aria-label="Playback quality"
                    >
                      <Player.SelectValue placeholder="Select a quality..." />
                      <Player.SelectIcon>
                        <ChevronDownIcon className="h-4 w-4" />
                      </Player.SelectIcon>
                    </Player.SelectTrigger>
                    <Player.SelectPortal>
                      <Player.SelectContent className="overflow-hidden rounded-sm bg-gray-400 z-[60]">
                        <Player.SelectViewport className="p-[5px]">
                          <Player.SelectGroup>
                            <VideoQualitySelectItem value="auto">
                              Auto (HD+)
                            </VideoQualitySelectItem>
                            <VideoQualitySelectItem value="1080p">
                              1080p (HD)
                            </VideoQualitySelectItem>
                            <VideoQualitySelectItem value="720p">
                              720p
                            </VideoQualitySelectItem>
                            <VideoQualitySelectItem value="480p">
                              480p
                            </VideoQualitySelectItem>
                            <VideoQualitySelectItem value="360p">
                              360p
                            </VideoQualitySelectItem>
                          </Player.SelectGroup>
                        </Player.SelectViewport>
                      </Player.SelectContent>
                    </Player.SelectPortal>
                  </Player.VideoQualitySelect>
                </div>
                <div className="flex flex-col gap-2">
                  {subtitles && <SubtitlesLanguageSelect />}
                </div>
              </div>
              <Popover.Close
                className="absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full outline-none"
                aria-label="Close"
              >
                <XIcon />
              </Popover.Close>
              <Popover.Arrow className="fill-white/50" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      );
    }
  );
  Settings.displayName = "Settings";

  const RateSelectItem = React.forwardRef<
    HTMLDivElement,
    Player.RateSelectItemProps
  >(({ children, className, ...props }, forwardedRef) => {
    return (
      <Player.RateSelectItem
        className={cn(
          `relative flex h-7 select-none items-center rounded-sm pl-[25px] pr-[35px] text-xs 
          leading-none data-[disabled]:pointer-events-none data-[highlighted]:bg-white/20 data-[highlighted]:outline-none`,
          className
        )}
        {...props}
        ref={forwardedRef}
      >
        <Player.SelectItemText>{children}</Player.SelectItemText>
        <Player.SelectItemIndicator className="absolute left-0 inline-flex w-[25px] items-center justify-center">
          <CheckIcon className="h-4 w-4" />
        </Player.SelectItemIndicator>
      </Player.RateSelectItem>
    );
  });
  RateSelectItem.displayName = "RateSelectItem";

  const VideoQualitySelectItem = React.forwardRef<
    HTMLDivElement,
    Player.VideoQualitySelectItemProps
  >(({ children, className, ...props }, forwardedRef) => {
    return (
      <Player.VideoQualitySelectItem
        className={cn(
          `relative flex h-7 select-none items-center rounded-sm pl-[25px] pr-[35px] text-xs 
          leading-none data-[disabled]:pointer-events-none data-[highlighted]:bg-white/20 data-[highlighted]:outline-none`,
          className
        )}
        {...props}
        ref={forwardedRef}
      >
        <Player.SelectItemText>{children}</Player.SelectItemText>
        <Player.SelectItemIndicator className="absolute left-0 inline-flex w-[25px] items-center justify-center">
          <CheckIcon className="h-4 w-4" />
        </Player.SelectItemIndicator>
      </Player.VideoQualitySelectItem>
    );
  });
  VideoQualitySelectItem.displayName = "VideoQualitySelectItem";

  if (!asset) {
    return (
      <PlayerLoading
        title="Invalid source"
        description="We could not fetch valid playback information for the playback ID you provided. Please check and try again."
      />
    );
  }

  return (
    <SubtitlesProvider>
      <SubtitlesInitializer assetMetadata={null} />
      <div className="w-full">
        <div className="w-full space-y-6">
          <h1 className="text-2xl font-bold">{videoTitle || asset?.name}</h1>
          {creatorAddress && (
            <CreatorDisplay
              creatorAddress={creatorAddress}
              playbackId={asset?.playbackId || undefined}
              className="mt-2"
            />
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {isVideoAdmin && asset?.status?.phase && (
              <Badge>{asset.status.phase}</Badge>
            )}
            {isVideoAdmin && dbStatus && <Badge variant="secondary">{dbStatus}</Badge>}
            {livepeerAttestationId && (
              <Badge
                variant="secondary"
                className="gap-1"
                title="Creator-attested (Livepeer Verifiable Video)"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Verifiable
              </Badge>
            )}
          </div>
          {(storyIpRegistered && storyIpId) && (
            <StoryIPBlock
              storyIpId={storyIpId}
              storyScanBase={STORY_SCAN_IP_BASE}
              licenseTermsId={storyLicenseTermsId}
              videoTitle={videoTitle}
            />
          )}
          {/* Render other asset details */}
          {!isConnected ? (
            // Connect wallet prompt overlay
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-800">
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt={videoTitle || asset?.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-50"
                />
              )}
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold text-white">
                      Connect Your Account
                    </h2>
                    <p className="text-gray-300">
                      Please select &quot;Get Started&quot; to watch this video.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      openAuthModal();
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 
                      hover:from-blue-700 hover:to-purple-700 text-white 
                      px-8 py-3 text-lg font-semibold transition-all duration-300 hover:shadow-lg"
                  >
                    Get Started
                  </Button>
                </div>
              </div>
            </div>
          ) : sourcesLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : sourcesError ? (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-lg bg-gray-800 p-8 text-center">
              <p className="text-lg font-medium text-white">Failed to load video</p>
              <p className="text-sm text-gray-300">{sourcesError}</p>
              <Button type="button" variant="outline" onClick={() => void loadPlaybackSources()}>
                Retry
              </Button>
            </div>
          ) : playbackSources ? (
            <>
              <Player.Root
                src={playbackSources}
                playbackId={asset?.playbackId}
                volume={0}
                {...conditionalProps}
              >
                <Player.Container ref={containerRef} className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-800">
                  <Player.Video
                    title={asset?.name}
                    className="h-full w-full"
                    poster={thumbnailUrl || undefined}
                    onTimeUpdate={handleShoppableTimeUpdate}
                  />
                  <CreativeBrandOverlay />
                  {shoppableCampaignId && shoppableAnnotations.length > 0 ? (
                    <ShoppableOverlay
                      activeAnnotations={activeShoppable}
                      campaignId={shoppableCampaignId}
                      allAnnotations={shoppableAnnotations}
                    />
                  ) : null}
                  <Player.LoadingIndicator
                    className="relative h-full w-full bg-black/50 backdrop-blur data-[visible=true]:animate-in 
                  data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
                  >
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <LoadingIcon className="h-8 w-8 animate-spin" />
                    </div>
                    <PlayerLoading />
                  </Player.LoadingIndicator>

                  <Player.ErrorIndicator
                    matcher="all"
                    className="absolute inset-0 flex select-none flex-col items-center justify-center gap-4 bg-black/40 
                    text-center backdrop-blur-lg duration-1000 data-[visible=true]:animate-in 
                    data-[visible=false]:animate-out data-[visible=false]:fade-out-0 
                    data-[visible=true]:fade-in-0"
                  >
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <LoadingIcon className="h-8 w-8 animate-spin" />
                    </div>
                    <PlayerLoading />
                  </Player.ErrorIndicator>

                  <Player.ErrorIndicator
                    matcher="offline"
                    className="absolute inset-0 flex select-none flex-col items-center justify-center 
                    gap-4 bg-black/40 text-center backdrop-blur-lg duration-1000 animate-in fade-in-0 
                    data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-1">
                        <div className="text-lg font-bold sm:text-2xl">
                          Stream is offline
                        </div>
                        <div className="text-xs text-gray-100 sm:text-sm">
                          Playback will start automatically once the stream has
                          started
                        </div>
                      </div>
                      <LoadingIcon className="mx-auto h-6 w-6 animate-spin md:h-8 md:w-8" />
                    </div>
                  </Player.ErrorIndicator>

                  <Player.ErrorIndicator
                    matcher="access-control"
                    className="absolute inset-0 flex select-none flex-col items-center 
                    justify-center gap-4 bg-black/40 text-center backdrop-blur-lg duration-1000 
                    data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-1">
                        <div className="text-lg font-bold sm:text-2xl">
                          Stream is private
                        </div>
                        <div className="text-xs text-gray-100 sm:text-sm">
                          It looks like you don&apos;t have permission to view
                          this content
                        </div>
                      </div>
                      <LoadingIcon className="mx-auto h-6 w-6 animate-spin md:h-8 md:w-8" />
                    </div>
                  </Player.ErrorIndicator>

                  {/* Play button overlay - shows when video is not playing */}
                  <Player.PlayingIndicator
                    matcher={false}
                    className="absolute inset-0 z-20 flex items-center justify-center 
                    data-[visible=true]:animate-in data-[visible=false]:animate-out 
                    data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0 pointer-events-none"
                  >
                    <Player.PlayPauseTrigger className="group relative flex h-20 w-20 cursor-pointer 
                      touch-none items-center justify-center rounded-full bg-black/50 
                      hover:bg-black/70 transition-all duration-200 hover:scale-110 pointer-events-auto">
                      <Player.PlayingIndicator asChild matcher={false}>
                        <PlayIcon
                          className="h-12 w-12 ml-1"
                          style={{ color: "#EC407A" }}
                        />
                      </Player.PlayingIndicator>
                      <Player.PlayingIndicator asChild>
                        <PauseIcon
                          className="h-12 w-12"
                          style={{ color: "#EC407A" }}
                        />
                      </Player.PlayingIndicator>
                    </Player.PlayPauseTrigger>
                  </Player.PlayingIndicator>

                  <Player.Controls
                    className="relative z-30 flex flex-col-reverse gap-1 bg-gradient-to-b 
                  from-black/5 via-black/30 via-80% to-black/60 px-3 py-2 duration-1000 
                  data-[visible=true]:animate-in data-[visible=false]:animate-out 
                  data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0 md:px-3"
                  >
                    <div className="flex justify-between gap-4">
                      <div className="flex flex-1 items-center gap-3">
                        <Player.PlayPauseTrigger className="h-6 w-6 flex-shrink-0 transition hover:scale-110">
                          <Player.PlayingIndicator asChild matcher={false}>
                            <PlayIcon
                              className="h-full w-full"
                              style={{ color: "#EC407A" }}
                            />
                          </Player.PlayingIndicator>
                          <Player.PlayingIndicator asChild>
                            <PauseIcon
                              className="h-full w-full"
                              style={{ color: "#EC407A" }}
                            />
                          </Player.PlayingIndicator>
                        </Player.PlayPauseTrigger>

                        <Player.LiveIndicator className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                          <span className="select-none text-sm">LIVE</span>
                        </Player.LiveIndicator>
                        <Player.LiveIndicator
                          matcher={false}
                          className="flex items-center gap-2"
                        >
                          <Player.Time className="select-none text-sm tabular-nums text-gray-300" />
                        </Player.LiveIndicator>

                        <Player.MuteTrigger className="h-6 w-6 flex-shrink-0 transition hover:scale-110">
                          <Player.VolumeIndicator asChild matcher={false}>
                            <MuteIcon
                              className="h-full w-full"
                              style={{ color: "#EC407A" }}
                            />
                          </Player.VolumeIndicator>
                          <Player.VolumeIndicator asChild matcher={true}>
                            <UnmuteIcon className="h-full w-full text-gray-300" />
                          </Player.VolumeIndicator>
                        </Player.MuteTrigger>
                        <Player.Volume
                          className="group relative mr-1 flex h-5 max-w-[120px] 
                        flex-1 cursor-pointer touch-none select-none items-center"
                        >
                          <Player.Track
                            className="relative h-[2px] grow rounded-full bg-white/30 
                          transition group-hover:h-[3px] md:h-[3px] group-hover:md:h-[4px]"
                          >
                            <Player.Range className="absolute h-full rounded-full bg-gray-300" />
                          </Player.Track>
                          <Player.Thumb className="block h-3 w-3 rounded-full bg-white transition group-hover:scale-110" />
                        </Player.Volume>
                      </div>
                      <div className="flex items-center justify-end gap-2.5 sm:flex-1 md:flex-[1.5]">
                        <Player.FullscreenIndicator matcher={false} asChild>
                          <Settings className="h-6 w-6 flex-shrink-0 text-gray-300 transition" />
                        </Player.FullscreenIndicator>
                        {/* <Clip className="flex items-center w-6 h-6 justify-center" /> */}

                        <Player.PictureInPictureTrigger className="h-6 w-6 flex-shrink-0 transition hover:scale-110">
                          <PictureInPictureIcon
                            className="h-full w-full"
                            style={{ color: "#EE774D" }}
                          />
                        </Player.PictureInPictureTrigger>

                        <Player.FullscreenTrigger className="h-6 w-6 flex-shrink-0 transition hover:scale-110">
                          <Player.FullscreenIndicator asChild>
                            <ExitFullscreenIcon
                              className="h-full w-full"
                              style={{ color: "#EC407A" }}
                            />
                          </Player.FullscreenIndicator>

                          <Player.FullscreenIndicator matcher={false} asChild>
                            <EnterFullscreenIcon
                              className="h-full w-full"
                              style={{ color: "#FACB80" }}
                            />
                          </Player.FullscreenIndicator>
                        </Player.FullscreenTrigger>
                      </div>
                    </div>
                    <Seek
                      className="relative flex h-5 items-center "
                      style={{ touchAction: "none", userSelect: "none" }}
                    />
                  </Player.Controls>
                </Player.Container>
              </Player.Root>
            </>
          ) : (
            <Skeleton className="h-96 w-full" />
          )}
        </div>
      </div>
    </SubtitlesProvider>
  );
}

export const PlayerLoading = ({
  title,
  description,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
}) => (
  <div className="relative flex aspect-video w-full flex-col-reverse gap-3 overflow-hidden rounded-sm bg-white/10 px-3 py-2">
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-pulse overflow-hidden rounded-lg bg-white/5" />
        <div className="h-6 w-16 animate-pulse overflow-hidden rounded-lg bg-white/5 md:h-7 md:w-20" />
      </div>

      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-pulse overflow-hidden rounded-lg bg-white/5" />
        <div className="h-6 w-6 animate-pulse overflow-hidden rounded-lg bg-white/5" />
      </div>
    </div>
    <div className="h-2 w-full animate-pulse overflow-hidden rounded-lg bg-white/5" />

    {title && (
      <div className="absolute inset-10 flex flex-col items-center justify-center gap-1 text-center">
        <span className="text-lg font-medium text-white">{title}</span>
        {description && (
          <span className="text-sm text-white/80">{description}</span>
        )}
      </div>
    )}
  </div>
);

function SubtitlesInitializer({
  assetMetadata,
}: {
  assetMetadata: any;
}) {
  const { setSubtitles } = useSubtitles();

  useEffect(() => {
    if (assetMetadata?.subtitles) {
      setSubtitles(assetMetadata.subtitles);
    }
  }, [assetMetadata, setSubtitles]);

  return null;
}
