import { Asset } from "livepeer/models/components";
import VideoDetails from "@/components/Videos/VideoDetails";
import { fetchAssetId } from "@/app/api/livepeer/actions";
import { getVideoAssetByAssetId } from "@/services/video-assets";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Slash } from "lucide-react";
import VideoViewMetrics from "@/components/Videos/VideoViewMetrics";
import { VideoCommentsWrapper } from "@/components/Videos/VideoCommentsWrapper";
import { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { Suspense } from "react";
import { VideoShareButton } from "@/components/Videos/VideoShareButton";
import { VideoHeartBitSection } from "@/components/heartbit/VideoHeartBitSection";
import { BuyIPButton } from "@/components/Videos/BuyIPButton";
import { CreatorMessageButton } from "@/components/Videos/CreatorMessageButton";
import { VideoEditButton } from "@/components/Videos/VideoEditButton";
import { VideoSplitDistributeButton } from "@/components/Videos/VideoSplitDistributeButton";
import { RemixInPixelsButton } from "@/components/Videos/RemixInPixelsButton";
import { AddToMixtapeButton } from "@/components/Videos/AddToMixtapeButton";
import { VideoPredictButton } from "@/components/Videos/VideoPredictButton";
import { ActivePredictionsStripServer } from "./ActivePredictionsStripServer";
import { logger } from '@/lib/utils/logger';
import {
  getSiteOrigin,
  getVideoOgImageUrl,
  VIDEO_OG_IMAGE,
} from "@/lib/utils/og-image";

type VideoDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type VideoAssetRow = Awaited<ReturnType<typeof getVideoAssetByAssetId>>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assetFromVideoRow(
  videoAsset: NonNullable<VideoAssetRow>,
  assetId: string,
): Asset {
  return {
    id: videoAsset.asset_id || assetId,
    name: videoAsset.title || "Video",
    playbackId: videoAsset.playback_id || undefined,
  } as Asset;
}

async function loadVideoPageData(id: string): Promise<{
  assetData: Asset | null;
  videoAsset: VideoAssetRow | null;
}> {
  if (!UUID_REGEX.test(id)) {
    logger.error("Invalid video asset ID format:", id);
    return { assetData: null, videoAsset: null };
  }

  // Isolate Neon from Livepeer so a Livepeer outage cannot wipe a valid DB row.
  const [dbResult, livepeerResult] = await Promise.allSettled([
    getVideoAssetByAssetId(id),
    fetchAssetId(id),
  ]);

  const videoAsset =
    dbResult.status === "fulfilled" ? dbResult.value : null;
  if (dbResult.status === "rejected") {
    logger.error("Error fetching video asset from database:", dbResult.reason);
  }

  let assetData: Asset | null = null;
  if (livepeerResult.status === "fulfilled") {
    assetData = livepeerResult.value?.asset ?? null;
  } else {
    logger.error("Error fetching Livepeer asset:", livepeerResult.reason);
  }

  if (!videoAsset) {
    logger.error("Video asset not found in database");
    return { assetData: null, videoAsset: null };
  }

  if (!assetData) {
    assetData = assetFromVideoRow(videoAsset, id);
  }

  return { assetData, videoAsset };
}

export default async function VideoDetailsPage({
  params,
}: VideoDetailsPageProps) {
  const { id } = await params;
  const { assetData, videoAsset } = await loadVideoPageData(id);

  if (!videoAsset || !assetData) {
    return <div>Asset not found</div>;
  }

  const creatorAddress = videoAsset?.creator_id || null;

  return (
    <div className="container max-w-7xl mx-auto px-4">
      <div className="my-5">
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
                <Link href="/discover">Discover</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <Slash />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink>
                <BreadcrumbPage>{videoAsset?.title || assetData?.name}</BreadcrumbPage>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <VideoDetails
              asset={assetData}
              videoTitle={videoAsset?.title || assetData?.name}
              creatorAddress={creatorAddress}
              livepeerAttestationId={videoAsset?.livepeer_attestation_id ?? null}
              storyIpRegistered={videoAsset?.story_ip_registered ?? false}
              storyIpId={videoAsset?.story_ip_id ?? null}
              storyLicenseTermsId={videoAsset?.story_license_terms_id ?? null}
              contractAddress={videoAsset?.contract_address ?? null}
              tokenId={videoAsset?.token_id ?? null}
            />
            {creatorAddress && (
              <div className="mt-4">
                <VideoHeartBitSection
                  videoId={assetData.playbackId || id}
                  videoIpfsHash={videoAsset?.metadata_uri ?? null}
                  creatorAddress={creatorAddress}
                />
              </div>
            )}
            {/* Actions (right-aligned) → views → date, each on its own row */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap justify-end ml-auto">
                {creatorAddress && (
                  <>
                    <Suspense fallback={<div className="h-9 w-9" />}>
                      <VideoEditButton
                        videoAssetId={id}
                        creatorId={creatorAddress}
                      />
                    </Suspense>
                    <Suspense fallback={<div className="h-9 w-9" />}>
                      <VideoSplitDistributeButton
                        videoAssetId={id}
                        creatorId={creatorAddress}
                        splitsAddress={videoAsset?.splits_address || null}
                      />
                    </Suspense>
                  </>
                )}
                <Suspense fallback={<div className="h-9 w-9" />}>
                  {creatorAddress &&
                    videoAsset?.attributes?.content_coin_id && (
                      <CreatorMessageButton
                        creatorAddress={creatorAddress}
                        meTokenAddress={
                          videoAsset.attributes.content_coin_id as string
                        }
                      />
                    )}
                </Suspense>
                {videoAsset?.story_ip_registered &&
                  videoAsset?.story_ip_id &&
                  videoAsset?.story_license_terms_id && (
                    <Suspense fallback={<div className="h-9 w-9" />}>
                      <BuyIPButton
                        ipId={videoAsset.story_ip_id}
                        licenseTermsId={String(videoAsset.story_license_terms_id)}
                        videoTitle={videoAsset?.title || assetData?.name || "Video"}
                      />
                    </Suspense>
                  )}
                <Suspense fallback={<div className="h-9 w-9" />}>
                  <AddToMixtapeButton
                    assetId={id}
                    videoTitle={videoAsset?.title || assetData?.name || "Video"}
                    playbackId={assetData?.playbackId || undefined}
                  />
                </Suspense>
                {videoAsset?.story_ip_registered && videoAsset?.story_license_terms_id && (
                  <Suspense fallback={<div className="h-9 w-9" />}>
                    <RemixInPixelsButton />
                  </Suspense>
                )}
                <Suspense fallback={<div className="h-9 w-9" />}>
                  <VideoPredictButton
                    videoAssetId={id}
                    videoTitle={videoAsset?.title || assetData?.name || "Video"}
                  />
                </Suspense>
                <Suspense fallback={<div className="h-9 w-9" />}>
                  <VideoShareButton
                    videoId={id}
                    videoTitle={videoAsset?.title || "Video"}
                    playbackId={assetData?.playbackId || undefined}
                  />
                </Suspense>
              </div>
              {assetData.playbackId && (
                <div className="min-h-4">
                  <VideoViewMetrics
                    playbackId={assetData.playbackId}
                    fallbackViews={videoAsset?.views_count ?? 0}
                  />
                </div>
              )}
              {videoAsset?.created_at ? (
                <div>
                  <span className="text-sm text-muted-foreground md:text-base">
                    {new Date(videoAsset.created_at).toLocaleDateString()}
                  </span>
                </div>
              ) : null}
            </div>
            {videoAsset?.description && (
              <div className="mt-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {videoAsset.description}
                  </ReactMarkdown>
                </div>
              </div>
            )}

          <Suspense fallback={<div className="h-24" />}>
            <ActivePredictionsStripServer videoAssetId={id} />
          </Suspense>
        </div>

          {videoAsset && (
            <div className="mt-8">
              <VideoCommentsWrapper
                videoAssetId={videoAsset.id}
                videoName={videoAsset.title || assetData?.name || "this video"}
                creatorAddress={creatorAddress}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      logger.error("Invalid video asset ID format for metadata:", id);
      return { title: "Video Not Found" };
    }

    const { assetData, videoAsset } = await loadVideoPageData(id);

    if (!videoAsset || !assetData) {
      return { title: "Video Not Found" };
    }

    const baseUrl = getSiteOrigin();
    const absoluteUrl = `${baseUrl}/discover/${id}`;

    // Use the same-origin proxy for OG images — Telegram/SMS crawlers can't
    // fetch IPFS gateway URLs (grove.storage, ipfs.io, etc). The proxy fetches
    // the image server-side and serves it from our domain.
    const ogImageUrl = getVideoOgImageUrl({ id });

    let videoTitle = (videoAsset as any)?.title || assetData.name || "Watch Video";
    if (videoTitle.endsWith('.mp4')) {
      videoTitle = videoTitle.slice(0, -4);
    }

    const videoDescription = (videoAsset as any)?.description ?? `Watch ${videoTitle} on Creative TV`;

    const ogImage = {
      url: ogImageUrl,
      secureUrl: ogImageUrl,
      width: VIDEO_OG_IMAGE.width,
      height: VIDEO_OG_IMAGE.height,
      alt: videoTitle || VIDEO_OG_IMAGE.alt,
    };

    return {
      title: videoTitle,
      description: videoDescription,
      openGraph: {
        title: videoTitle,
        description: videoDescription,
        images: [ogImage],
        url: absoluteUrl,
        type: "website",
        siteName: "Creative TV",
      },
      twitter: {
        card: "summary_large_image",
        title: videoTitle,
        description: videoDescription,
        // Same absolute proxy URL as og:image so each video ID has a thumbnail card
        images: [ogImageUrl],
      },
    };
  } catch (error) {
    logger.error("Error generating metadata:", error);
    return { title: "Video Not Found" };
  }
}
