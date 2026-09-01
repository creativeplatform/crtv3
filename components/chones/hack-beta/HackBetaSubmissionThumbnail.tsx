"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import VideoThumbnail from "@/components/Videos/VideoThumbnail";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchVideoAssetByAssetId } from "@/lib/utils/video-assets-client";
import { cn } from "@/lib/utils";

type HackBetaSubmissionThumbnailProps = {
  playbackId?: string | null;
  thumbnailUrl?: string | null;
  title?: string | null;
  assetId?: string | null;
  className?: string;
};

type ResolvedMedia = {
  playbackId: string | null;
  thumbnailUrl: string | null;
};

/**
 * Resolves submission media the same way Discover / upload history do:
 * stored thumbnail → video_assets by playback/asset id → Livepeer VTT → brand fallback.
 */
export function HackBetaSubmissionThumbnail({
  playbackId,
  thumbnailUrl,
  title,
  assetId,
  className,
}: HackBetaSubmissionThumbnailProps) {
  const [resolved, setResolved] = useState<ResolvedMedia>({
    playbackId: playbackId?.trim() || null,
    thumbnailUrl: thumbnailUrl?.trim() || null,
  });
  const [isResolving, setIsResolving] = useState(
    !playbackId?.trim() && Boolean(assetId?.trim()),
  );

  useEffect(() => {
    const storedPlayback = playbackId?.trim() || null;
    const storedThumb = thumbnailUrl?.trim() || null;

    if (storedPlayback) {
      setResolved({ playbackId: storedPlayback, thumbnailUrl: storedThumb });
      setIsResolving(false);
      return;
    }

    const id = assetId?.trim();
    if (!id) {
      setResolved({ playbackId: null, thumbnailUrl: storedThumb });
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    setIsResolving(true);

    void fetchVideoAssetByAssetId(id)
      .then((asset) => {
        if (cancelled) return;
        const fromAsset =
          (asset as { playback_id?: string } | null)?.playback_id?.trim() || null;
        const thumbFromAsset =
          storedThumb ||
          (asset as { thumbnail_url?: string } | null)?.thumbnail_url?.trim() ||
          (asset as { thumbnailUri?: string } | null)?.thumbnailUri?.trim() ||
          null;
        setResolved({ playbackId: fromAsset, thumbnailUrl: thumbFromAsset });
      })
      .catch(() => {
        if (cancelled) return;
        setResolved({ playbackId: null, thumbnailUrl: storedThumb });
      })
      .finally(() => {
        if (!cancelled) setIsResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [playbackId, thumbnailUrl, assetId]);

  if (isResolving) {
    return <Skeleton className={cn("aspect-video w-full rounded-none", className)} />;
  }

  if (!resolved.playbackId) {
    return (
      <div
        className={cn(
          "flex aspect-video w-full items-center justify-center bg-muted/40",
          className,
        )}
      >
        <Film className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("aspect-video w-full overflow-hidden bg-black", className)}>
      <VideoThumbnail
        playbackId={resolved.playbackId}
        src={null}
        title={title || "Hack Beta demo"}
        assetId={assetId || undefined}
        initialThumbnailUrl={resolved.thumbnailUrl || undefined}
        className="h-full w-full"
        hidePlayOverlay
      />
    </div>
  );
}
