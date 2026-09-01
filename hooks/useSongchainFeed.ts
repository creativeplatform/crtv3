'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnyClient } from '@lens-protocol/client';
import { fetchPosts } from '@lens-protocol/client/actions';
import { evmAddress } from '@lens-protocol/types';
import type { AnyPost } from '@lens-protocol/graphql';
import { createLensClient } from '@/lib/sdk/lens/create-client';
import { useLensOrbWrite } from '@/hooks/useLensOrbWrite';
import { clearStaleOrbSessionIfNeeded } from '@/lib/sdk/orb/session-errors';
import {
  extractLensContractAddress,
  getLensContractAddressError,
} from '@/lib/sdk/lens/primitive-id';
import { checkLensFeedExists } from '@/lib/songchain/lens-feed';
import { normalizeFeedPosts } from '@/lib/songchain/post-utils';
import { waitForPostIndexed } from '@/lib/songchain/wait-for-post-index';
import type { PendingFeedPost, SongchainCreatedPost } from '@/lib/songchain/feed-types';

type UseSongchainFeedOptions = {
  feedId: string | null;
  enabled?: boolean;
};

export function useSongchainFeed({ feedId, enabled = true }: UseSongchainFeedOptions) {
  const [posts, setPosts] = useState<AnyPost[]>([]);
  const [pendingPosts, setPendingPosts] = useState<PendingFeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const pollAbortsRef = useRef<Map<string, AbortController>>(new Map());
  const { canWrite, getSessionClient } = useLensOrbWrite();

  const getClient = useCallback(async (): Promise<AnyClient> => {
    let client: AnyClient = createLensClient();
    if (canWrite) {
      try {
        client = await getSessionClient();
      } catch (err) {
        clearStaleOrbSessionIfNeeded(err);
        client = createLensClient();
      }
    }
    return client;
  }, [canWrite, getSessionClient]);

  const fetchPage = useCallback(
    async (mode: 'replace' | 'append') => {
      if (!feedId || !enabled) return;

      const feedAddress = extractLensContractAddress(feedId);
      if (!feedAddress) {
        setPosts([]);
        cursorRef.current = null;
        setHasMore(false);
        setError(getLensContractAddressError(feedId, 'Feed contract ID'));
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const feedCheck = await checkLensFeedExists(feedId);
        if (!feedCheck.exists) {
          setPosts([]);
          cursorRef.current = null;
          setHasMore(false);
          setError(feedCheck.error);
          return;
        }

        const client = await getClient();
        const result = await fetchPosts(client, {
          filter: {
            feeds: [{ feed: evmAddress(feedAddress) }],
          },
          cursor: mode === 'append' ? (cursorRef.current ?? undefined) : undefined,
        });

        if (result.isErr()) {
          throw new Error(result.error.message);
        }

        const page = result.value;
        cursorRef.current = page.pageInfo.next ?? null;
        setHasMore(Boolean(page.pageInfo.next));
        setPosts((prev) => {
          const combined =
            mode === 'append'
              ? normalizeFeedPosts([...prev, ...page.items])
              : normalizeFeedPosts([...page.items]);
          return combined;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feed');
      } finally {
        setLoading(false);
      }
    },
    [feedId, enabled, getClient],
  );

  useEffect(() => {
    if (!feedId || !enabled) {
      setPosts([]);
      cursorRef.current = null;
      setHasMore(false);
      setError(null);
      return;
    }
    cursorRef.current = null;
    void fetchPage('replace');
  }, [feedId, enabled, canWrite, fetchPage]);

  const reload = useCallback(() => {
    cursorRef.current = null;
    return fetchPage('replace');
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return Promise.resolve();
    return fetchPage('append');
  }, [fetchPage, hasMore, loading]);

  const registerNewPost = useCallback(
    (created: SongchainCreatedPost) => {
      pollAbortsRef.current.get(created.postId)?.abort();
      const controller = new AbortController();
      pollAbortsRef.current.set(created.postId, controller);

      const localId = `pending-${created.postId}`;
      setPendingPosts((prev) => [
        {
          kind: 'pending',
          localId,
          postId: created.postId,
          content: created.content,
          thumbnailUrl: created.thumbnailUrl,
          title: created.title,
        },
        ...prev.filter((p) => p.postId !== created.postId),
      ]);

      void (async () => {
        try {
          const client = await getClient();
          const indexed = await waitForPostIndexed(client, created.postId, {
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          if (indexed) {
            setPosts((prev) => normalizeFeedPosts([indexed, ...prev]));
            setPendingPosts((prev) => prev.filter((p) => p.postId !== created.postId));
          } else {
            setPendingPosts((prev) =>
              prev.map((p) =>
                p.postId === created.postId ? { ...p, timedOut: true } : p,
              ),
            );
            await reload();
            setPendingPosts((prev) => prev.filter((p) => p.postId !== created.postId));
          }
        } catch {
          if (!controller.signal.aborted) {
            setPendingPosts((prev) =>
              prev.map((p) =>
                p.postId === created.postId ? { ...p, timedOut: true } : p,
              ),
            );
          }
        } finally {
          if (pollAbortsRef.current.get(created.postId) === controller) {
            pollAbortsRef.current.delete(created.postId);
          }
        }
      })();
    },
    [getClient, reload],
  );

  useEffect(() => {
    return () => {
      pollAbortsRef.current.forEach((ctrl) => ctrl.abort());
      pollAbortsRef.current.clear();
    };
  }, []);

  return {
    posts,
    pendingPosts,
    loading,
    error,
    hasMore,
    reload,
    loadMore,
    registerNewPost,
  };
}
