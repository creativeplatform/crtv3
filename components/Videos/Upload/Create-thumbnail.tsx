"use client";
import {
  getLivepeerAsset,
  getLivepeerPlaybackInfo,
} from "@/app/api/livepeer/assetUploadActions";
import { Player } from "@/components/Player/Player";
import { Button } from "@/components/ui/button";
import { Src } from "@livepeer/react";
import { getSrc } from "@livepeer/react/external";
import { Asset, PlaybackInfo } from "livepeer/models/components";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useInterval } from "@/lib/hooks/useInterval";
import CreateThumbnailForm from "./CreateThumbnailForm";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

type CreateThumbnailProps = {
  livePeerAssetId: string | undefined;
  thumbnailUri?: string;
  videoAssetId?: number;
  creatorAddress?: string;
  metadataURI?: string;
  onComplete: (data: {
    thumbnailUri: string;
    meTokenConfig?: {
      requireMeToken: boolean;
      priceInMeToken: number;
    };
    storyConfig?: {
      registerIP: boolean;
      licenseTerms?: any;
    };
    nftMintResult?: {
      tokenId: string;
      contractAddress: string;
      txHash: string;
    };
    createdMeToken?: {
      address: string;
      id: string;
    };
  }) => Promise<void> | void;
};

export default function CreateThumbnail({
  livePeerAssetId,
  thumbnailUri,
  videoAssetId,
  creatorAddress,
  metadataURI,
  onComplete,
}: CreateThumbnailProps) {
  const router = useRouter();
  const [livepeerAssetData, setLivepeerAssetData] = useState<Asset>();
  const [livepeerPlaybackData, setLivepeerPlaybackData] =
    useState<PlaybackInfo>();
  const [selectedThumbnail, setSelectedThumbnail] = useState<string>();
  const [meTokenConfig, setMeTokenConfig] = useState<{
    requireMeToken: boolean;
    priceInMeToken: number;
  } | undefined>(undefined);
  const [storyConfig, setStoryConfig] = useState<{
    registerIP: boolean;
    licenseTerms?: any;
  } | undefined>(undefined);
  const [nftMintResult, setNftMintResult] = useState<{
    tokenId: string;
    contractAddress: string;
    txHash: string;
  } | null>(null);
  const [createdMeToken, setCreatedMeToken] = useState<{
    address: string;
    id: string;
  } | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);

  // Log component initialization
  useEffect(() => {
    logger.debug('✅ CreateThumbnail mounted with asset ID:', livePeerAssetId);
  }, [livePeerAssetId]);

  useInterval(
    () => {
      if (livePeerAssetId) {
        getLivepeerAsset(livePeerAssetId)
          .then((data) => {
            if (!data) {
              logger.error('No asset data returned for ID:', livePeerAssetId);
              toast.error("Failed to retrieve video information. Please refresh the page.");
              return;
            }

            logger.debug('Livepeer asset status:', {
              assetId: livePeerAssetId,
              phase: data?.status?.phase,
              progress: data?.status?.progress,
              errorMessage: data?.status?.errorMessage,
              updatedAt: data?.status?.updatedAt,
              hasPlaybackId: !!data?.playbackId,
            });

            setLivepeerAssetData(data);

            if (data?.status?.phase === "failed") {
              logger.error('Transcoding failed. Full asset data:', JSON.stringify(data, null, 2));
              const errorMsg = data.status.errorMessage || "Unknown error during video processing";

              // Check if it's a codec/container error
              const isCodecError = errorMsg.toLowerCase().includes('codec') ||
                errorMsg.toLowerCase().includes('container');

              if (isCodecError) {
                toast.error(
                  "Video format not supported",
                  {
                    duration: 15000,
                    description: "Your video file uses an unsupported codec. Please convert it to H.264 or H.265 codec in an MP4 container. Tools like HandBrake or FFmpeg can help convert your video."
                  }
                );
              } else {
                toast.error(
                  `Video transcoding failed: ${errorMsg}`,
                  {
                    duration: 10000,
                    description: "Please try uploading your video again or contact support."
                  }
                );
              }
              return false;
            }

            if (data?.status?.phase === "ready") {
              toast.success("Video is ready!", { duration: 2000 });
            }
          })
          .catch((e) => {
            logger.error("Error retrieving livepeer asset:", {
              assetId: livePeerAssetId,
              error: e?.message,
              stack: e?.stack,
            });
            toast.error(
              e?.message || "Error retrieving video status. Please refresh the page.",
              { duration: 5000 }
            );
          });
      } else {
        logger.warn('No livePeerAssetId provided to polling interval');
      }
    },
    livepeerAssetData?.status?.phase !== "ready" &&
      livepeerAssetData?.status?.phase !== "failed"
      ? 5000
      : null
  );

  // Initial fetch on mount
  useEffect(() => {
    if (livePeerAssetId && !livepeerAssetData) {
      logger.debug('Initial fetch for asset:', livePeerAssetId);
      getLivepeerAsset(livePeerAssetId)
        .then((data) => {
          if (data) {
            logger.debug('Initial asset data fetched:', {
              phase: data?.status?.phase,
              progress: data?.status?.progress,
            });
            setLivepeerAssetData(data);
          }
        })
        .catch((e) => {
          logger.error("Error on initial asset fetch:", e);
          toast.error(
            "Failed to load video information. Please check if the video was uploaded successfully.",
            { duration: 5000 }
          );
        });
    }
  }, [livePeerAssetId, livepeerAssetData]);

  useEffect(() => {
    if (
      livepeerAssetData?.status?.phase === "ready" &&
      livepeerAssetData.playbackId
    ) {
      getLivepeerPlaybackInfo(livepeerAssetData.playbackId).then((data) => {
        setLivepeerPlaybackData(data);
      });
    }
  }, [livepeerAssetData]);

  const handleBack = () => {
    router.back();
  };

  const handleComplete = (thumbnailUri: string) => {
    if (!livepeerAssetData) {
      toast.error("Video data not found. Please try again.");
      return;
    }

    // Validate thumbnail URI is not empty
    if (!thumbnailUri || thumbnailUri.trim() === "") {
      toast.error("Please select a thumbnail before publishing.");
      return;
    }

    setSelectedThumbnail(thumbnailUri);
    // Use the parameter directly instead of state to avoid stale state issues
    onComplete({
      thumbnailUri: thumbnailUri,
      meTokenConfig: meTokenConfig,
    });
  };

  const handleSubmit = async () => {
    // Require thumbnail selection for better UX and to avoid breaking downstream code
    if (!selectedThumbnail) {
      toast.error("Please select a thumbnail before publishing.");
      return;
    }

    try {
      setIsPublishing(true);
      await onComplete({
        thumbnailUri: selectedThumbnail,
        meTokenConfig: meTokenConfig,
        storyConfig: storyConfig,
        nftMintResult: nftMintResult || undefined,
        createdMeToken: createdMeToken || undefined,
      });
    } catch (error) {
      logger.error("Publication failed:", error);
      toast.error("Failed to publish video. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Memoize callbacks to prevent infinite loops in child component
  const handleSelectThumbnailImages = useCallback((thumbnailUri: string) => {
    setSelectedThumbnail(thumbnailUri);
  }, []);

  const handleMeTokenConfigChange = useCallback((config: {
    requireMeToken: boolean;
    priceInMeToken: number;
  }) => {
    setMeTokenConfig(config);
  }, []);

  const handleStoryConfigChange = useCallback((config: {
    registerIP: boolean;
    licenseTerms?: any;
  }) => {
    setStoryConfig(config);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="my-6 text-center">
        <h4 className="text-2xl font-bold">Almost Done...</h4>
      </div>

      {/* Asset ID is guaranteed to exist when this component renders */}
      {livePeerAssetId && (
        <>
          <div className="my-4">
            <h3 className="text-lg">
              Video Transcoding: {livepeerAssetData?.status?.phase ? String(livepeerAssetData.status.phase) : "Loading..."}
            </h3>
            {!livepeerAssetData && (
              <p className="text-sm text-muted-foreground mt-2">
                Fetching video information...
              </p>
            )}

            {/* Show detailed error message and help for failed transcoding */}
            {livepeerAssetData?.status?.phase === "failed" && (
              <div className="my-6 p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
                <h3 className="text-lg font-semibold text-destructive mb-3">
                  ❌ Video Processing Failed
                </h3>
                <p className="text-sm text-destructive/90 mb-4">
                  <strong>Error:</strong> {livepeerAssetData.status.errorMessage}
                </p>
                <div className="bg-card p-4 rounded border border-border mb-4">
                  <p className="text-sm text-foreground mb-2">
                    <strong>How to fix this:</strong>
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Convert your video to <strong>H.264</strong> or <strong>H.265</strong> codec</li>
                    <li>Save it in <strong>MP4</strong> container format</li>
                    <li>Use free tools like <a href="https://handbrake.fr/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">HandBrake</a> or FFmpeg</li>
                    <li>Re-upload your converted video</li>
                  </ol>
                  <div className="mt-3 p-3 bg-accent rounded border border-border">
                    <p className="text-xs text-foreground">
                      💡 <strong>Quick HandBrake settings:</strong> Use the &quot;Fast 1080p30&quot; preset with H.264 codec
                    </p>
                  </div>
                </div>
                <Button onClick={handleBack} variant="default" className="w-full sm:w-auto">
                  ← Go Back and Upload a Different Video
                </Button>
              </div>
            )}
            {livepeerAssetData?.status?.phase !== "ready" &&
              livepeerAssetData?.status?.phase !== "failed" &&
              typeof livepeerAssetData?.status?.progress === "number" && (
                <div className="mt-4">
                  <Progress
                    value={
                      livepeerAssetData.status.progress > 1
                        ? livepeerAssetData.status.progress
                        : livepeerAssetData.status.progress * 100
                    }
                  />
                  <div className="text-center text-sm mt-1 text-muted-foreground">
                    {Math.round(
                      livepeerAssetData.status.progress > 1
                        ? livepeerAssetData.status.progress
                        : livepeerAssetData.status.progress * 100
                    )}
                    %
                  </div>
                </div>
              )}
          </div>
          {livepeerAssetData?.status?.phase !== "ready" && (
            <div className="my-6">
              <Skeleton className="w-full aspect-video rounded-lg" />
            </div>
          )}
          {livepeerAssetData?.status?.phase === "ready" && livepeerPlaybackData && (
            <div className="my-6">
              <Player
                title={livepeerAssetData.name}
                assetId={livepeerAssetData.id}
                src={getSrc(livepeerPlaybackData) as Src[]}
              />
            </div>
          )}

          <div className="my-5">
            <div className="mx-auto my-4">
              <h3 className="text-xl font-bold">Generate a Thumbnail</h3>
            </div>
            <CreateThumbnailForm
              livepeerAssetId={livePeerAssetId}
              assetReady={livepeerAssetData?.status?.phase === "ready"}
              videoAssetId={videoAssetId}
              creatorAddress={creatorAddress as `0x${string}` | undefined}
              metadataURI={metadataURI || livepeerAssetData?.storage?.ipfs?.nftMetadata?.url}
              onSelectThumbnailImages={handleSelectThumbnailImages}
              onMeTokenConfigChange={handleMeTokenConfigChange}
              onStoryConfigChange={handleStoryConfigChange}
              onNFTMinted={(result) => {
                setNftMintResult({
                  tokenId: result.tokenId,
                  contractAddress: result.contractAddress,
                  txHash: result.txHash,
                });
              }}
              onMeTokenCreated={(address, txHash, id) => {
                if (address && id) {
                  setCreatedMeToken({ address, id });
                }
              }}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full px-4">
            <Button
              disabled={livepeerAssetData?.status?.phase === "processing"}
              onClick={handleBack}
              variant="outline"
              className="w-full sm:w-auto min-w-[120px] touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              Back
            </Button>
            <Button
              disabled={
                !selectedThumbnail || livepeerAssetData?.status?.phase !== "ready" || isPublishing
              }
              onClick={handleSubmit}
              className="w-full sm:w-auto min-w-[120px] touch-manipulation relative"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              id="publish-video-btn"
            >
              {isPublishing ? (
                <>
                  <span className="opacity-0">Publish</span>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                </>
              ) : (
                "Publish"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
