"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Chain } from "viem";
import { fetchWalletTokenBalances } from "@/lib/sdk/alchemy/wallet-balances";
import type { WalletTokenBalances } from "@/lib/sdk/alchemy/wallet-balances";
import { priceService } from "@/lib/sdk/alchemy/price-service";
import {
  SWAP_UI_TOKENS,
  emptyTokenPrices,
  type TokenSymbol,
} from "@/lib/sdk/alchemy/swap-service";
import { logger } from "@/lib/utils/logger";

export type { WalletTokenBalances };

type RefetchOptions = {
  /** When true, keep showing existing balances while refreshing. */
  background?: boolean;
};

const EMPTY_BALANCES: WalletTokenBalances = {
  ETH: null,
  USDC: null,
  DAI: null,
  USDS: null,
  GHO: null,
};

function isBaseChain(chain: Chain): boolean {
  return chain.id === 8453;
}

export function useTokenBalances(
  address: string | undefined,
  chain: Chain | undefined
) {
  const [balances, setBalances] = useState<WalletTokenBalances>(EMPTY_BALANCES);
  const [prices, setPrices] =
    useState<Record<TokenSymbol, number>>(emptyTokenPrices());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchGenerationRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(
    async (options?: RefetchOptions) => {
      const generation = ++fetchGenerationRef.current;
      const background = options?.background ?? false;
      const showLoading = !background || !hasLoadedRef.current;

      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      if (!address || !chain) {
        if (generation !== fetchGenerationRef.current) return;
        setBalances(EMPTY_BALANCES);
        setIsLoading(false);
        hasLoadedRef.current = false;
        return;
      }

      if (!isBaseChain(chain)) {
        if (generation !== fetchGenerationRef.current) return;
        setError(`Unsupported chain (ID: ${chain.id})`);
        setBalances(EMPTY_BALANCES);
        setIsLoading(false);
        hasLoadedRef.current = false;
        return;
      }

      try {
        const [nextBalances, tokenPrices] = await Promise.all([
          fetchWalletTokenBalances(address),
          priceService.getTokenPrices([...SWAP_UI_TOKENS]),
        ]);

        if (generation !== fetchGenerationRef.current) return;

        setBalances(nextBalances);
        setPrices(tokenPrices);
        hasLoadedRef.current = true;
      } catch (err) {
        if (generation !== fetchGenerationRef.current) return;

        logger.error("Error fetching balances:", err);
        const message = err instanceof Error ? err.message : "Unknown error";

        if (!hasLoadedRef.current) {
          setError(message);
          setBalances(EMPTY_BALANCES);
        }
      } finally {
        if (generation === fetchGenerationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [address, chain]
  );

  useEffect(() => {
    hasLoadedRef.current = false;
    void refetch();
  }, [refetch]);

  return { balances, prices, isLoading, error, refetch };
}
