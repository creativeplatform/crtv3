"use client";

/**
 * Ensures a Lens "going live" root post exists for a stream session (option B).
 * Chat is implemented as comments on that post.
 *
 * Uses NEXT_PUBLIC_LIVE_LENS_FEED_ID (platform live feed), not Songchain.
 */

import { useCallback, useState } from "react";
import { useSongchainPost } from "@/hooks/useSongchainPost";
import {
  buildGoingLivePostContent,
  getLiveLensFeedConfigError,
  getLiveLensFeedId,
} from "@/lib/live/lens-live-feed";
import { updateStream } from "@/services/streams";
import { walletAuthHeadersToArgs } from "@/lib/auth/require-wallet";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { logger } from "@/lib/utils/logger";
import type { StreamSummary } from "@/lib/songchain/build-lens-livestream-metadata";

export function useEnsureLiveLensPost() {
  const { createPost, isPosting } = useSongchainPost();
  const { getAuthHeaders } = useWalletAuth();
  const [error, setError] = useState<string | null>(null);

  const ensureLivePost = useCallback(
    async (params: {
      creatorAddress: string;
      existingPostId?: string | null;
      stream: StreamSummary;
      title?: string;
      /** Optional override of the going-live caption body. */
      contentOverride?: string;
    }): Promise<string | null> => {
      setError(null);
      if (params.existingPostId) return params.existingPostId;

      const feedId = getLiveLensFeedId();
      if (!feedId) {
        const msg = getLiveLensFeedConfigError()!;
        setError(msg);
        logger.warn(msg);
        return null;
      }

      const watchUrl =
        typeof window !== "undefined" && params.stream.playback_id
          ? `${window.location.origin}/watch/${params.stream.playback_id}`
          : "";
      const streamName = params.stream.name?.trim() || "Live stream";
      const content =
        params.contentOverride?.trim() ||
        buildGoingLivePostContent({ streamName, watchUrl });

      try {
        const created = await createPost({
          content,
          feedId,
          title: params.title || streamName,
          attachedLiveStream: {
            ...params.stream,
            is_live: true,
          },
        });

        const postId = created?.postId ?? null;
        if (!postId) {
          setError("Failed to create Lens live post");
          return null;
        }

        const auth = walletAuthHeadersToArgs(await getAuthHeaders());
        await updateStream(
          params.creatorAddress,
          { lens_live_post_id: postId },
          auth
        );
        return postId;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to create live Lens post";
        setError(msg);
        logger.error("ensureLivePost failed:", err);
        return null;
      }
    },
    [createPost, getAuthHeaders]
  );

  return { ensureLivePost, isPosting, error };
}
