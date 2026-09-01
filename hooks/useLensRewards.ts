"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTokenDistributions } from "@lens-protocol/client/actions";
import { PageSize } from "@lens-protocol/graphql";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { LENS_GHO_TOKEN_ADDRESS } from "@/lib/songchain/halliday";

export type LensReward = {
  id: string;
  txHash: string | null;
  timestamp: Date;
  amount: string;
  symbol: string;
  decimals: number;
  contractAddress: string;
  chainId: number;
  isGho: boolean;
};

export type UseLensRewardsResult = {
  rewards: LensReward[];
  ghoRewards: LensReward[];
  totalGho: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function parseBigDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  try {
    const str = typeof value === "number" ? value.toString() : value;
    if (!str || isNaN(Number(str))) return "0";
    return str;
  } catch {
    return "0";
  }
}

function isGhoDistribution(reward: LensReward): boolean {
  const ghoAddress = LENS_GHO_TOKEN_ADDRESS.toLowerCase();
  return (
    reward.contractAddress.toLowerCase() === ghoAddress ||
    reward.symbol.toUpperCase() === "GHO"
  );
}

function sumGho(rewards: LensReward[]): string {
  return rewards
    .filter(isGhoDistribution)
    .reduce((acc, r) => {
      try {
        return (Number(acc) + Number(r.amount)).toString();
      } catch {
        return acc;
      }
    }, "0");
}

export function useLensRewards(): UseLensRewardsResult {
  const { canWrite, getSessionClient } = useLensOrbWrite();
  const [rewards, setRewards] = useState<LensReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canWrite) {
      setRewards([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = await getSessionClient();
      const result = await fetchTokenDistributions(client, {
        pageSize: PageSize.Fifty,
      });

      if (result.isErr()) {
        throw new Error(result.error.message);
      }

      const items = result.value.items.map((item, index): LensReward => {
        const amount = item.amount;
        const asset = amount.asset;
        const value = parseBigDecimal(
          "value" in amount ? (amount as { value: string }).value : null,
        );

        return {
          id: `${item.txHash ?? index}-${item.timestamp}`,
          txHash: item.txHash ?? null,
          timestamp: new Date(item.timestamp),
          amount: value,
          symbol: asset.symbol,
          decimals: asset.decimals,
          contractAddress: asset.contract.address,
          chainId: asset.contract.chainId,
          isGho: false,
        };
      });

      const enriched = items.map((r) => ({ ...r, isGho: isGhoDistribution(r) }));
      setRewards(enriched);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load rewards";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [canWrite, getSessionClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const ghoRewards = rewards.filter((r) => r.isGho);
  const totalGho = sumGho(rewards);

  return {
    rewards,
    ghoRewards,
    totalGho,
    loading,
    error,
    refresh: load,
  };
}
