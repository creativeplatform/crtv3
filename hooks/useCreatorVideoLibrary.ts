'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@/lib/wallet/react';
import useModularAccount from '@/lib/hooks/accountkit/useModularAccount';
import type { VideoAsset } from '@/lib/types/video-asset';
import { fetchPublishedVideos } from '@/lib/utils/published-videos-client';

export function useCreatorVideoLibrary() {
  const user = useUser();
  const { account: modularAccount } = useModularAccount();
  const creatorId = modularAccount?.address || user?.address || null;

  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!creatorId) {
      setVideos([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await fetchPublishedVideos({
        creatorId,
        limit: 100,
        orderBy: 'created_at',
        order: 'desc',
      });
      setVideos(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { videos, loading, error, reload, creatorId, hasWallet: !!creatorId };
}
