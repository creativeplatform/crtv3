"use client";
import { useState, useEffect, useRef } from "react";
import {
  Broadcast,
  createStreamViaProxy,
  fetchStreamKeyForCreator,
} from "@/components/Live/Broadcast";
import { updateStream } from "@/services/streams";
import { useCreatorWalletAddress } from "@/lib/hooks/accountkit/useCreatorWalletAddress";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { walletAuthHeadersToArgs } from "@/lib/auth/require-wallet";
import { LivePageClient } from "./LivePageClient";
import { userMessageForStreamProxyError, StreamProxyError } from "@/lib/livepeer/stream-proxy-errors";
import { formatWalletAuthError } from "@/lib/auth/format-wallet-auth-error";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Slash, VideoIcon, Share2, ShieldCheck, Radio } from "lucide-react";
import { useCreatorLiveStream } from "@/hooks/useCreatorLiveStream";
import { SongchainShareLiveDialog } from "@/components/songchain/SongchainShareLiveDialog";
import { FaExclamationTriangle } from "react-icons/fa";
import { MembershipGuard } from "@/components/auth/MembershipGuard";
import { ProfilePageGuard } from "@/components/UserProfile/UserProfile";
import { MultistreamTargetsForm } from "@/components/Live/multicast/MultistreamTargetsForm";
import { MultistreamTargetsList } from "@/components/Live/multicast/MultistreamTargetList";
import {
  listMultistreamTargets,
  MultistreamTarget,
} from "@/services/video-assets";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LivestreamThumbnail } from "@/components/Live/LivestreamThumbnail";
import { StreamThumbnailUploader } from "@/components/Live/StreamThumbnailUploader";
import { StreamNameEditor } from "@/components/Live/StreamNameEditor";
import { StreamMeTokenGateEditor } from "@/components/Live/StreamMeTokenGateEditor";
import { StreamIPRegistration } from "@/components/Live/StreamIPRegistration";
import { CreatorClipsList } from "@/components/Live/CreatorClipsList";
import { getThumbnailUrl } from "@/services/livepeer-thumbnails";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { LiveTokenPanel } from "@/components/Live/LiveTokenPanel";
import { LensLiveChat } from "@/components/Live/LensLiveChat";
import { useEnsureLiveLensPost } from "@/hooks/useEnsureLiveLensPost";
import { buildGoingLivePostContent } from "@/lib/live/lens-live-feed";
import { ShareDialog } from "@/components/Videos/ShareDialog";
import { useLivepeerRealtimeMetrics } from "@/lib/hooks/livepeer/useLivepeerRealtimeMetrics";
import { ModeratorsDialog } from "@/components/Live/ModeratorsDialog";
import { DigitalTwinOverlay } from "@/components/Live/DigitalTwinOverlay";
import { logger } from '@/lib/utils/logger';
import { isPlatformAdmin } from "@/lib/access/platform-admin";
import { useMembershipVerification } from "@/lib/hooks/unlock/useMembershipVerification";
import {
  hasValidCreatorPass,
  hasValidBrandPass,
} from "@/lib/access/creator-membership";

async function fetchStreamKeyWithRetry(
  creatorAddress: string,
  authHeaders: Record<string, string>,
  legacyCreatorAddress?: string | null,
) {
  try {
    return await fetchStreamKeyForCreator(
      creatorAddress,
      authHeaders,
      legacyCreatorAddress,
    );
  } catch (err) {
    if (err instanceof StreamProxyError && err.code === "BOTID_DENIED") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return fetchStreamKeyForCreator(
        creatorAddress,
        authHeaders,
        legacyCreatorAddress,
      );
    }
    throw err;
  }
}


export default function LivePage() {
  const { creatorAddress, signerAddress, smartAccountAddress, eoaAddress, isConnected, isLoading: isWalletLoading } = useCreatorWalletAddress();
  const { getAuthHeaders, isReady: isWalletAuthReady } = useWalletAuth();
  const { membershipDetails, isLoading: isMembershipLoading } = useMembershipVerification();
  const canStream =
    isPlatformAdmin(creatorAddress) ||
    hasValidCreatorPass(membershipDetails) ||
    hasValidBrandPass(membershipDetails);
  const [multistreamTargets, setMultistreamTargets] = useState<
    MultistreamTarget[]
  >([]);
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const { address: addressParam } = useParams();
  const urlAddress = Array.isArray(addressParam) ? addressParam[0] : addressParam;
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [isCreatingStream, setIsCreatingStream] = useState(false);
  const [streamCreateError, setStreamCreateError] = useState<string | null>(
    null
  );
  const [allowClipping, setAllowClipping] = useState(true);
  const [isUpdatingClipPref, setIsUpdatingClipPref] = useState(false);
  const [streamName, setStreamName] = useState<string | null>(null);
  const [saveRecording, setSaveRecording] = useState(true);
  const [isUpdatingSaveRecording, setIsUpdatingSaveRecording] = useState(false);
  const [requiresMetoken, setRequiresMetoken] = useState(false);
  const [metokenPrice, setMetokenPrice] = useState<number | null>(null);
  const [storyIpId, setStoryIpId] = useState<string | null>(null);
  const [storyLicenseTermsId, setStoryLicenseTermsId] = useState<string | null>(null);
  const [storyRevShare, setStoryRevShare] = useState<number | null>(null);
  const [lensLivePostId, setLensLivePostId] = useState<string | null>(null);
  const { ensureLivePost, isPosting: isEnsuringLensPost } =
    useEnsureLiveLensPost();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [songchainShareOpen, setSongchainShareOpen] = useState(false);
  const [moderatorsDialogOpen, setModeratorsDialogOpen] = useState(false);
  const { stream: liveStream, isLive: isStreamLive } = useCreatorLiveStream(15_000);
  const songchainFeedId =
    process.env.NEXT_PUBLIC_SONGCHAIN_FEED_ID?.trim() || null;
  const recordingEnableRequestedRef = useRef<Set<string>>(new Set());

  // Match the viewer-side derivation in WatchClient so host + viewers share the
  // same XMTP group ID.
  const chatStreamId = playbackId || "";
  const chatSessionId = playbackId ? `session-${playbackId}` : "";
  const { viewerCount } = useLivepeerRealtimeMetrics(playbackId || "");


  const identityReady =
    !isWalletLoading &&
    !!creatorAddress &&
    (!smartAccountAddress ||
      !!signerAddress ||
      (!!eoaAddress &&
        eoaAddress.toLowerCase() === creatorAddress.toLowerCase()));

  // Fetch existing stream and multistream targets
  useEffect(() => {
    let active = true;

    setStreamKey(null);
    setStreamId(null);
    setPlaybackId(null);
    setThumbnailUrl(null);
    setAllowClipping(true);
    setStreamName(null);
    setSaveRecording(true);
    setRequiresMetoken(false);
    setMetokenPrice(null);
    setStoryIpId(null);
    setStoryLicenseTermsId(null);
    setStoryRevShare(null);
    setMultistreamTargets([]);
    setIsLoadingTargets(false);

    async function fetchStreamAndTargets() {
      if (!identityReady || !creatorAddress) return;

      try {
        const authHeaders = await getAuthHeaders();
        if (!active) return;
        const legacy = signerAddress ?? undefined;

        try {
          const keyData = await fetchStreamKeyWithRetry(
            creatorAddress,
            authHeaders,
            legacy,
          );
          if (!active) return;
          setStreamKey(keyData.streamKey);
          setStreamId(keyData.streamId);
          setPlaybackId(keyData.playbackId);

          if (!recordingEnableRequestedRef.current.has(keyData.streamId)) {
            recordingEnableRequestedRef.current.add(keyData.streamId);
            fetch(`/api/livepeer/stream/${encodeURIComponent(keyData.streamId)}/recording`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ record: saveRecording }),
            }).catch((err) => logger.error("Failed to set stream recording state:", err));
          }

          setIsLoadingTargets(true);
          const result = await listMultistreamTargets({ streamId: keyData.streamId });
          if (!active) return;
          setIsLoadingTargets(false);
          if (result.targets) {
            setMultistreamTargets(result.targets);
          } else if (result.error) {
            logger.error("Error fetching multistream targets:", result.error);
          }
        } catch (keyErr) {
          logger.debug("No stream key yet for creator:", keyErr);
          if (active) {
            setMultistreamTargets([]);
          }
        }

        const params = new URLSearchParams();
        if (legacy) params.set("legacyCreatorAddress", legacy);
        const query = params.toString();
        const res = await fetch(
          `/api/streams/creator/${encodeURIComponent(creatorAddress)}${query ? `?${query}` : ""}`,
          { cache: "no-store" },
        );

        if (res.ok) {
          const stream = await res.json();
          if (!active) return;
          if (!stream?.playback_id) return;
          if (stream.stream_id) setStreamId(stream.stream_id);
          setPlaybackId(stream.playback_id);
          setThumbnailUrl(stream.thumbnail_url || null);
          setAllowClipping(stream.allow_clipping ?? true);
          setStreamName(stream.name ?? null);
          setSaveRecording(stream.save_recording ?? true);
          setRequiresMetoken(stream.requires_metoken ?? false);
          setMetokenPrice(stream.metoken_price ?? null);
          setStoryIpId(stream.story_ip_id ?? null);
          setStoryLicenseTermsId(stream.story_license_terms_id ?? null);
          setStoryRevShare(stream.story_commercial_rev_share ?? null);
          setLensLivePostId(stream.lens_live_post_id ?? null);
        } else {
          logger.error("Error fetching stream metadata:", await res.text());
        }
      } catch (err) {
        logger.error("Error fetching stream data:", err);
      }
    }

    fetchStreamAndTargets();

    return () => {
      active = false;
    };
  }, [creatorAddress, signerAddress, getAuthHeaders, identityReady]);

  useEffect(() => {
    async function fetchThumbnail() {
      if (!addressParam) return;

      const id = Array.isArray(addressParam) ? addressParam[0] : addressParam;

      // Skip thumbnail fetch if streamId is an Ethereum address
      // Livepeer playback IDs don't start with 0x
      if (id.startsWith('0x')) {
        setThumbnailLoading(false);
        setThumbnailError(null);
        setThumbnailUrl(null);
        return;
      }

      setThumbnailLoading(true);
      setThumbnailError(null);
      const res = (await getThumbnailUrl({
        playbackId: id,
      })) as import("@/lib/types/actions").ActionResponse<{
        thumbnailUrl: string;
      }>;
      if (res.success && res.data?.thumbnailUrl)
        setThumbnailUrl(res.data.thumbnailUrl);
      else setThumbnailError(res.error || "Thumbnail not found");
      setThumbnailLoading(false);
    }
    fetchThumbnail();
  }, [addressParam]);

  function handleTargetAdded(target: MultistreamTarget) {
    setMultistreamTargets((prev) => [...prev, target]);
  }

  function handleTargetRemoved(id: string) {
    setMultistreamTargets((prev) => prev.filter((t) => t.id !== id));
  }

  function handleThumbnailUpdated(url: string) {
    setThumbnailUrl(url);
  }

  function handleNameUpdated(name: string) {
    setStreamName(name);
  }

  function handleGateUpdated(config: {
    requiresMetoken: boolean;
    metokenPrice: number | null;
  }) {
    setRequiresMetoken(config.requiresMetoken);
    setMetokenPrice(config.metokenPrice);
  }

  async function handleToggleClipping(next: boolean) {
    if (!creatorAddress) return;
    const previous = allowClipping;
    setAllowClipping(next);
    setIsUpdatingClipPref(true);
    try {
      const auth = walletAuthHeadersToArgs(await getAuthHeaders());
      await updateStream(creatorAddress, { allow_clipping: next }, auth);
    } catch (err) {
      logger.error("Failed to update clipping preference:", err);
      setAllowClipping(previous);
    } finally {
      setIsUpdatingClipPref(false);
    }
  }

  async function handleToggleSaveRecording(next: boolean) {
    if (!creatorAddress || !streamId) return;
    const previous = saveRecording;
    setSaveRecording(next);
    setIsUpdatingSaveRecording(true);
    try {
      const auth = walletAuthHeadersToArgs(await getAuthHeaders());
      await updateStream(creatorAddress, { save_recording: next }, auth);
      // Sync the recording flag on the Livepeer stream object as well.
      await fetch(`/api/livepeer/stream/${encodeURIComponent(streamId)}/recording`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record: next }),
      });
    } catch (err) {
      logger.error("Failed to update save-recording preference:", err);
      setSaveRecording(previous);
    } finally {
      setIsUpdatingSaveRecording(false);
    }
  }

  async function handleCreateStream() {
    if (!creatorAddress) return;
    if (!identityReady || !isWalletAuthReady) {
      setStreamCreateError("Wallet is still initializing. Wait a moment and try again.");
      return;
    }
    setIsCreatingStream(true);
    setStreamCreateError(null);
    try {
      let authHeaders;
      try {
        authHeaders = await getAuthHeaders();
      } catch (authErr) {
        setStreamCreateError(formatWalletAuthError(authErr));
        return;
      }
      const result = await createStreamViaProxy({
        creatorAddress,
        legacyCreatorAddress: signerAddress,
        name: `Broadcast-${Date.now()}`,
        profiles: [
          {
            name: "480p",
            width: 854,
            height: 480,
            bitrate: 1_000_000,
            fps: 30,
            fpsDen: 1,
            quality: 23,
            gop: "2",
            profile: "H264Baseline",
          },
          {
            name: "720p",
            width: 1280,
            height: 720,
            bitrate: 2_500_000,
            fps: 30,
            fpsDen: 1,
            quality: 23,
            gop: "2",
            profile: "H264Baseline",
          },
          {
            name: "1080p",
            width: 1920,
            height: 1080,
            bitrate: 4_500_000,
            fps: 30,
            fpsDen: 1,
            quality: 23,
            gop: "2",
            profile: "H264Baseline",
          },
        ],
        record: saveRecording,
        playbackPolicy: { type: "jwt" },
        authHeaders,
      });

      const streamKeyValue = result.streamKey;
      const streamIdValue = result.streamId;
      const playbackIdValue = result.playbackId;

      if (streamKeyValue) {
        setStreamKey(streamKeyValue);
        if (streamIdValue) {
          setStreamId(streamIdValue);
          if (playbackIdValue) setPlaybackId(playbackIdValue);
        }
      } else {
        setStreamCreateError("Stream key not found in response");
      }
    } catch (e) {
      logger.error("Failed to create stream:", e);
      setStreamCreateError(userMessageForStreamProxyError(e));
    } finally {
      setIsCreatingStream(false);
    }
  }

  if (!isConnected) {
    return (
      <ProfilePageGuard>
        <MembershipGuard>
          <div className="min-h-screen p-6">
            <Alert variant="destructive">
              <FaExclamationTriangle className="h-4 w-4" />
              <AlertTitle>Authentication Required</AlertTitle>
              <AlertDescription>
                Please connect your wallet to access the live streaming feature.
              </AlertDescription>
            </Alert>
          </div>
        </MembershipGuard>
      </ProfilePageGuard>
    );
  }

  if (!isMembershipLoading && !canStream) {
    return (
      <ProfilePageGuard>
        <MembershipGuard>
          <div className="min-h-screen p-6">
            <Alert variant="destructive">
              <FaExclamationTriangle className="h-4 w-4" />
              <AlertTitle>Live streaming not available</AlertTitle>
              <AlertDescription>
                Live streaming is available to Creator and Brand members only.
              </AlertDescription>
            </Alert>
          </div>
        </MembershipGuard>
      </ProfilePageGuard>
    );
  }

  return (
    <LivePageClient urlAddress={urlAddress ?? ""}>
    <ProfilePageGuard>
      <MembershipGuard>
        <div className="min-h-screen p-4 md:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  <BreadcrumbLink>
                    <BreadcrumbPage>Live</BreadcrumbPage>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="flex items-center gap-2 text-lg font-bold text-red-600 dark:text-red-400">
              <VideoIcon className="h-5 w-5" />
              <span>Live Studio</span>
            </h1>
          </div>
          <div>
            {!streamKey ? (
              <div className="flex flex-col items-center justify-center my-8">
                {thumbnailLoading ? (
                  <div className="flex items-center justify-center h-32 text-gray-400 mb-6">
                    Loading thumbnail...
                  </div>
                ) : thumbnailError ? (
                  <div className="flex items-center justify-center h-32 text-red-400 mb-6">
                    {thumbnailError}
                  </div>
                ) : thumbnailUrl ? (
                  <div className="mb-6 w-full max-w-md">
                    <LivestreamThumbnail thumbnailUrl={thumbnailUrl} />
                  </div>
                ) : null}
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  Create your channel first — camera preview and live chat appear on the next step.
                </p>
                {!identityReady || !isWalletAuthReady ? (
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                    Preparing wallet…
                  </p>
                ) : null}
                <button
                  onClick={handleCreateStream}
                  disabled={isCreatingStream || !identityReady || !isWalletAuthReady}
                  className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isCreatingStream ? "Creating Stream..." : "Create Stream"}
                </button>
                {streamCreateError && (
                  <div className="text-red-500 mt-2">{streamCreateError}</div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="lg:col-span-2 relative">
                  <Broadcast
                    streamKey={streamKey}
                    streamId={streamId}
                    playbackId={playbackId}
                    creatorAddress={creatorAddress!}
                    saveRecording={saveRecording}
                  />
                  {creatorAddress && (
                    <DigitalTwinOverlay creatorAddress={creatorAddress} />
                  )}
                  {playbackId && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShareDialogOpen(true)}
                      >
                        <Share2 className="h-4 w-4 mr-1.5" /> Share Stream
                      </Button>
                      {isStreamLive && liveStream?.playback_id && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-red-500/40 text-red-400 hover:text-red-300"
                          onClick={() => setSongchainShareOpen(true)}
                        >
                          <Radio className="h-4 w-4 mr-1.5" /> Share to Songchain
                        </Button>
                      )}
                      {chatStreamId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setModeratorsDialogOpen(true)}
                        >
                          <ShieldCheck className="h-4 w-4 mr-1.5" /> Manage Moderators
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="lg:col-span-1">
                  {chatStreamId && chatSessionId && creatorAddress && (
                    <>
                      <LiveTokenPanel
                        creatorAddress={creatorAddress}
                        tokenInfo={undefined}
                        creatorMeToken={undefined}
                        streamId={chatStreamId}
                        sessionId={chatSessionId}
                        variant="host"
                      />
                      <LensLiveChat
                        lensPostId={lensLivePostId}
                        variant="host"
                        className="h-[min(70vh,520px)] mt-4"
                        ensuringPost={isEnsuringLensPost}
                        streamName={streamName}
                        goingLivePreview={
                          playbackId
                            ? buildGoingLivePostContent({
                                streamName: streamName || "Live stream",
                                watchUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || "https://tv.creativeplatform.xyz").replace(/\/$/, "")}/watch/${playbackId}`,
                              })
                            : null
                        }
                        onEnsurePost={async () => {
                          if (!playbackId || !creatorAddress) return null;
                          const siteOrigin = (
                            process.env.NEXT_PUBLIC_SITE_URL ||
                            "https://tv.creativeplatform.xyz"
                          ).replace(/\/$/, "");
                          const watchUrl = `${siteOrigin}/watch/${playbackId}`;
                          const content = buildGoingLivePostContent({
                            streamName: streamName || "Live stream",
                            watchUrl,
                          });
                          const postId = await ensureLivePost({
                            creatorAddress,
                            existingPostId: lensLivePostId,
                            stream: {
                              playback_id: playbackId,
                              name: streamName,
                              thumbnail_url: thumbnailUrl,
                              is_live: true,
                            },
                            contentOverride: content,
                          });
                          if (postId) setLensLivePostId(postId);
                          return postId;
                        }}
                      />
                    </>
                  )}
                  {!(chatStreamId && chatSessionId && creatorAddress) && (
                    <div className="border rounded-lg p-4 text-sm text-muted-foreground">
                      Chat will appear here once the stream is ready.
                    </div>
                  )}
                </div>
              </div>
            )}

            {streamId && (
              <div className="mt-4 border-t border-white/20 pt-3 max-w-[576px] mx-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Save live stream replay</p>
                    <p className="text-xs text-gray-400">
                      When the broadcast ends, publish the recording to your Discover feed.
                    </p>
                  </div>
                  <Switch
                    checked={saveRecording}
                    onCheckedChange={handleToggleSaveRecording}
                    disabled={isUpdatingSaveRecording}
                    aria-label="Save live stream replay"
                  />
                </div>
              </div>
            )}
            {streamId && creatorAddress && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                <StreamThumbnailUploader
                  creatorAddress={creatorAddress}
                  playbackId={playbackId || streamId}
                  currentThumbnailUrl={thumbnailUrl}
                  onThumbnailUpdated={handleThumbnailUpdated}
                />
                <StreamNameEditor
                  creatorAddress={creatorAddress}
                  currentName={streamName}
                  onNameUpdated={handleNameUpdated}
                />
                <StreamMeTokenGateEditor
                  creatorAddress={creatorAddress}
                  requiresMetoken={requiresMetoken}
                  metokenPrice={metokenPrice}
                  onGateUpdated={handleGateUpdated}
                />
              </div>
            )}
            {streamId && creatorAddress && (
              <StreamIPRegistration
                creatorAddress={creatorAddress}
                streamName={streamName}
                thumbnailUrl={thumbnailUrl}
                storyIpId={storyIpId}
                licenseTermsId={storyLicenseTermsId}
                commercialRevShare={storyRevShare}
                onRegistered={({ ipId, licenseTermsId, commercialRevShare }) => {
                  setStoryIpId(ipId);
                  setStoryLicenseTermsId(licenseTermsId);
                  setStoryRevShare(commercialRevShare);
                }}
              />
            )}
            {streamId && (
              <div className="mt-4 border-t border-white/20 pt-3 max-w-[576px] mx-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Allow viewer clipping</p>
                    <p className="text-xs text-gray-400">
                      Let viewers create short clips from your stream and mint them as NFTs.
                    </p>
                  </div>
                  <Switch
                    checked={allowClipping}
                    onCheckedChange={handleToggleClipping}
                    disabled={isUpdatingClipPref}
                    aria-label="Allow viewer clipping"
                  />
                </div>
              </div>
            )}
            {playbackId && (
              <CreatorClipsList playbackId={playbackId} />
            )}
            <div className="mt-4 border-t border-white/20 pt-3 max-w-[576px] mx-auto">
              <p className="mb-2 text-sm font-semibold">Multistream Targets</p>
              {streamId ? (
                <>
                  <MultistreamTargetsForm
                    streamId={streamId}
                    onTargetAdded={handleTargetAdded}
                    isStreamActive={!!streamKey}
                  />
                  {isLoadingTargets ? (
                    <div className="text-xs mt-2">Loading targets...</div>
                  ) : (
                    <>
                      <MultistreamTargetsList
                        targets={multistreamTargets}
                        onTargetRemoved={handleTargetRemoved}
                      />
                      {multistreamTargets.length === 0 && (
                        <div className="text-xs text-gray-400 mt-2">
                          No multistream targets configured. Your stream will only
                          be available on this platform.
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-400 mt-2">
                  Create a stream first to configure multistream targets.
                </div>
              )}
            </div>
          </div>
        </div>
        {liveStream?.playback_id && (
          <SongchainShareLiveDialog
            open={songchainShareOpen}
            onOpenChange={setSongchainShareOpen}
            stream={liveStream}
            feedId={songchainFeedId}
          />
        )}
        {playbackId && (
          <ShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            videoTitle={streamName || "Live Stream"}
            videoId={playbackId}
            shareUrlOverride={`/watch/${playbackId}`}
            titleOverride={streamName || "Live Stream"}
            thumbnailUrlOverride={thumbnailUrl ?? undefined}
            dialogTitle="Share Live Stream"
            shareNoun="live stream"
          />
        )}
        {chatStreamId && creatorAddress && (
          <ModeratorsDialog
            open={moderatorsDialogOpen}
            onOpenChange={setModeratorsDialogOpen}
            streamId={chatStreamId}
            creatorAddress={creatorAddress}
          />
        )}
      </MembershipGuard>
    </ProfilePageGuard>
    </LivePageClient>
  );
}
