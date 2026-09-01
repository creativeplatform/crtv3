'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCreatorWalletAddress } from '@/lib/hooks/accountkit/useCreatorWalletAddress';
import type { StreamSummary } from '@/lib/songchain/build-lens-livestream-metadata';

function isStreamSummary(data: unknown): data is StreamSummary {
  if (!data || typeof data !== 'object') return false;
  const row = data as Record<string, unknown>;
  return typeof row.playback_id === 'string' && row.playback_id.length > 0;
}

export function useCreatorLiveStream(pollMs = 30_000) {
  const {
    creatorAddress,
    signerAddress,
    smartAccountAddress,
    eoaAddress,
    isLoading,
  } = useCreatorWalletAddress();

  const [stream, setStream] = useState<StreamSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identityReady =
    !isLoading &&
    !!creatorAddress &&
    (!smartAccountAddress ||
      !!signerAddress ||
      (!!eoaAddress &&
        eoaAddress.toLowerCase() === creatorAddress.toLowerCase()));

  const reload = useCallback(async () => {
    if (!identityReady || !creatorAddress) {
      setStream(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (signerAddress) {
        params.set('legacyCreatorAddress', signerAddress);
      }
      const query = params.toString();
      const res = await fetch(
        `/api/streams/creator/${encodeURIComponent(creatorAddress)}${query ? `?${query}` : ''}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        throw new Error('Failed to load stream');
      }
      const data = (await res.json()) as unknown;
      setStream(isStreamSummary(data) ? data : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stream');
      setStream(null);
    } finally {
      setLoading(false);
    }
  }, [creatorAddress, signerAddress, identityReady]);

  useEffect(() => {
    if (!identityReady || !creatorAddress) {
      setStream(null);
      return;
    }
    void reload();
    const id = setInterval(() => void reload(), pollMs);
    return () => clearInterval(id);
  }, [reload, creatorAddress, identityReady, pollMs]);

  return {
    stream,
    isLive: !!stream?.is_live,
    loading,
    error,
    reload,
    creatorId: creatorAddress,
  };
}
