"use client";

import { useCallback, useState } from "react";
import { textOnly } from "@lens-protocol/metadata";
import { post } from "@lens-protocol/client/actions";
import { evmAddress, uri } from "@lens-protocol/client";
import { groveService } from "@/lib/sdk/grove/service";
import {
  clearStaleOrbSessionIfNeeded,
  isIncompleteOrbSessionError,
} from "@/lib/sdk/orb/session-errors";
import { formatOrbAuthError } from "@/lib/sdk/orb/format-auth-error";
import {
  checkLensFeedExists,
  formatLensFeedPostError,
  resolveSongchainFeedAddress,
} from "@/lib/songchain/lens-feed";
import { getLensContractAddressError } from "@/lib/sdk/lens/primitive-id";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { extractCreatedPostId } from "@/lib/songchain/post-utils";
import { buildLensVideoMetadataFromAsset } from "@/lib/songchain/build-lens-video-metadata";
import {
  buildLensImageMetadata,
  type SongchainAttachedImage,
} from "@/lib/songchain/build-lens-image-metadata";
import {
  buildLensLiveStreamMetadata,
  type StreamSummary,
} from "@/lib/songchain/build-lens-livestream-metadata";
import type { SongchainCreatedPost } from "@/lib/songchain/feed-types";
import type { VideoAsset } from "@/lib/types/video-asset";
import { toast } from "sonner";

export type CreateSongchainPostParams = {
  content: string;
  feedId: string;
  title?: string;
  attachedVideo?: VideoAsset | null;
  attachedLiveStream?: StreamSummary | null;
  /** Grove gateway URL + mime type from uploadToGrove */
  attachedImage?: SongchainAttachedImage | null;
};

function thumbnailFromAsset(asset: VideoAsset): string | undefined {
  return (
    asset.thumbnailUri ||
    (asset as { thumbnail_url?: string }).thumbnail_url ||
    undefined
  );
}

export function useSongchainPost() {
  const [isPosting, setIsPosting] = useState(false);
  const {
    canWrite,
    needsOrbReauth,
    getSessionClient,
    promptWriteAccess,
    lensAccount,
  } = useLensOrbWrite();

  const createPost = useCallback(
    async ({
      content,
      feedId,
      title = "Songchain post",
      attachedVideo,
      attachedLiveStream,
      attachedImage,
    }: CreateSongchainPostParams): Promise<SongchainCreatedPost | null> => {
      const trimmed = content.trim();
      const hasLive =
        !!attachedLiveStream?.is_live && !!attachedLiveStream.playback_id;
      const hasVideo = !!attachedVideo?.playback_id;
      const hasImage = !!attachedImage?.url?.trim();

      if (!trimmed && !hasVideo && !hasLive && !hasImage) {
        toast.error("Write something or attach media before posting.");
        return null;
      }
      if (!feedId) {
        toast.error("Feed is not configured.");
        return null;
      }
      if (attachedLiveStream && !attachedLiveStream.is_live) {
        toast.error("Your live stream is not active. Go live first.");
        return null;
      }

      const feedAddress = resolveSongchainFeedAddress(feedId);
      if (!feedAddress) {
        toast.error(getLensContractAddressError(feedId, "Feed contract ID") ?? "Invalid feed ID.");
        return null;
      }

      const feedCheck = await checkLensFeedExists(feedId);
      if (!feedCheck.exists) {
        toast.error(feedCheck.error ?? "Feed is not available on this Lens network.");
        return null;
      }

      if (!canWrite) {
        promptWriteAccess();
        toast.info(
          needsOrbReauth
            ? "Sign in again with Orb to post on Lens."
            : "Link your Orb account to post on Lens.",
        );
        return null;
      }

      setIsPosting(true);
      try {
        const client = await getSessionClient();

        let metadata;
        let displayTitle = title;
        let thumbnailUrl: string | undefined;

        if (hasLive && attachedLiveStream) {
          metadata = buildLensLiveStreamMetadata(attachedLiveStream, trimmed);
          displayTitle = attachedLiveStream.name?.trim() || "Live on Creative TV";
          thumbnailUrl = attachedLiveStream.thumbnail_url ?? undefined;
        } else if (hasVideo && attachedVideo) {
          metadata = await buildLensVideoMetadataFromAsset(attachedVideo, trimmed);
          displayTitle = attachedVideo.title;
          thumbnailUrl = thumbnailFromAsset(attachedVideo);
        } else if (hasImage && attachedImage) {
          metadata = buildLensImageMetadata(attachedImage, trimmed);
          displayTitle = trimmed || "Image post";
          thumbnailUrl = attachedImage.url.trim();
        } else {
          metadata = textOnly({
            content: trimmed,
            locale: "en",
          });
        }

        const uploadResult = await groveService.uploadJson(metadata);
        if (!uploadResult.success || !uploadResult.url) {
          throw new Error("Failed to upload post metadata");
        }

        const result = await post(client, {
          contentUri: uri(uploadResult.url),
          feed: evmAddress(feedAddress),
        });

        if (result.isErr()) {
          throw new Error(result.error.message);
        }

        const postId = extractCreatedPostId(result.value);
        if (!postId) {
          toast.success("Posted to Songchain feed!");
          await new Promise((r) => setTimeout(r, 2000));
          return {
            postId: `unknown-${Date.now()}`,
            content: trimmed || displayTitle,
            authorAddress: lensAccount ?? undefined,
            thumbnailUrl,
            title: displayTitle,
          };
        }

        toast.success("Posted to Songchain feed!");
        return {
          postId,
          content: trimmed || displayTitle,
          authorAddress: lensAccount ?? undefined,
          thumbnailUrl,
          title: displayTitle,
        };
      } catch (err) {
        const cleared = clearStaleOrbSessionIfNeeded(err);
        if (cleared || isIncompleteOrbSessionError(err)) {
          promptWriteAccess();
        }
        toast.error(
          isIncompleteOrbSessionError(err)
            ? formatOrbAuthError(err)
            : formatLensFeedPostError(err, feedId),
        );
        return null;
      } finally {
        setIsPosting(false);
      }
    },
    [canWrite, needsOrbReauth, getSessionClient, promptWriteAccess, lensAccount],
  );

  return { createPost, isPosting, canWrite, needsOrbReauth, promptWriteAccess };
}
