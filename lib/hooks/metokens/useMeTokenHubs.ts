"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HUB_ASSET_CONFIGS,
  HUB_PREFERENCE_ORDER,
  METOKEN_DIAMOND_BASE,
  type HubAssetSymbol,
} from '@/lib/contracts/MeTokenHubs';
import { publicClient } from '@/lib/viem';
import { logger } from '@/lib/utils/logger';

const HUB_INFO_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'hubId', type: 'uint256' }],
    name: 'getHubInfo',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'startTime', type: 'uint256' },
          { internalType: 'uint256', name: 'endTime', type: 'uint256' },
          { internalType: 'uint256', name: 'endCooldown', type: 'uint256' },
          { internalType: 'uint256', name: 'refundRatio', type: 'uint256' },
          { internalType: 'uint256', name: 'targetRefundRatio', type: 'uint256' },
          { internalType: 'address', name: 'owner', type: 'address' },
          { internalType: 'address', name: 'vault', type: 'address' },
          { internalType: 'address', name: 'asset', type: 'address' },
          { internalType: 'bool', name: 'updating', type: 'bool' },
          { internalType: 'bool', name: 'reconfigure', type: 'bool' },
          { internalType: 'bool', name: 'active', type: 'bool' },
        ],
        internalType: 'struct LibHub.HubInfo',
        name: 'hubInfo',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'count',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface MeTokenHubInfo {
  hubId: number;
  asset: `0x${string}`;
  vault: `0x${string}`;
  owner: `0x${string}`;
  active: boolean;
  symbol: HubAssetSymbol | 'UNKNOWN';
  label: string;
  displayName: string;
  description: string;
  deprecated?: boolean;
  recommended?: boolean;
  decimals: number;
}

function enrichHub(hubId: number, asset: `0x${string}`, info: {
  vault: `0x${string}`;
  owner: `0x${string}`;
  active: boolean;
}): MeTokenHubInfo {
  const known =
    Object.values(HUB_ASSET_CONFIGS).find(
      (c) => c.address.toLowerCase() === asset.toLowerCase()
    ) ??
    Object.values(HUB_ASSET_CONFIGS).find((c) => c.hubId === hubId);

  return {
    hubId,
    asset,
    vault: info.vault,
    owner: info.owner,
    active: info.active,
    symbol: known?.symbol ?? 'UNKNOWN',
    label: known?.displayName ?? `Hub ${hubId}`,
    displayName: known?.displayName ?? `Hub ${hubId}`,
    description: known?.description ?? 'Collateral hub',
    deprecated: known?.deprecated,
    recommended: known?.recommended,
    decimals: known?.decimals ?? 18,
  };
}

export function useMeTokenHubs() {
  const [hubs, setHubs] = useState<MeTokenHubInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHubs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const hubCount = await publicClient.readContract({
        address: METOKEN_DIAMOND_BASE,
        abi: HUB_INFO_ABI,
        functionName: 'count',
      });
      const hubIds = Array.from({ length: Number(hubCount) }, (_, i) => i + 1);
      const results = await Promise.all(
        hubIds.map(async (hubId) => {
          const info = await publicClient.readContract({
            address: METOKEN_DIAMOND_BASE,
            abi: HUB_INFO_ABI,
            functionName: 'getHubInfo',
            args: [BigInt(hubId)],
          });

          const asset = info.asset as `0x${string}`;
          const active =
            info.active && asset !== '0x0000000000000000000000000000000000000000';

          return enrichHub(hubId, asset, {
            vault: info.vault as `0x${string}`,
            owner: info.owner as `0x${string}`,
            active,
          });
        })
      );

      setHubs(results.filter((h) => h.active));
    } catch (err) {
      logger.error('Failed to fetch MeToken hubs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch hubs');
      setHubs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHubs();
  }, [fetchHubs]);

  const activeHubs = useMemo(() => hubs.filter((h) => h.active), [hubs]);

  const defaultHub = useMemo(
    () =>
      HUB_PREFERENCE_ORDER.map((sym) => activeHubs.find((h) => h.symbol === sym)).find(Boolean) ??
      activeHubs[0] ??
      null,
    [activeHubs]
  );

  const recommendedHubs = useMemo(
    () => activeHubs.filter((h) => h.recommended || h.symbol === 'USDC'),
    [activeHubs]
  );
  const legacyHubs = useMemo(
    () => activeHubs.filter((h) => h.deprecated || h.symbol === 'DAI'),
    [activeHubs]
  );

  return {
    hubs,
    activeHubs,
    recommendedHubs,
    legacyHubs,
    defaultHub,
    loading,
    error,
    refreshHubs: fetchHubs,
  };
}
