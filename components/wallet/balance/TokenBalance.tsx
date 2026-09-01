"use client";

import { useEffect } from "react";
import { useSmartAccountClient, useUser, useChain } from "@/lib/wallet/react";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { getTokenIcon } from "@/lib/utils/token-icons";
import {
  formatTokenBalance,
  tokenBalanceToUsd,
} from "@/lib/utils/format-token-balance";
import { useTokenBalances } from "@/lib/hooks/wallet/useTokenBalances";
import { PriceService } from "@/lib/sdk/alchemy/price-service";
import { TOKEN_INFO, type TokenSymbol } from "@/lib/sdk/alchemy/swap-service";

type TokenBalanceProps = {
  /** Refetch when the parent menu becomes visible (e.g. account dropdown opens). */
  isVisible?: boolean;
  /** Increment to force a balance refresh after send/swap. */
  refreshKey?: number;
};

const TOKEN_ROWS: TokenSymbol[] = ["ETH", "USDC", "DAI", "USDS", "GHO"];

export function TokenBalance({ isVisible, refreshKey = 0 }: TokenBalanceProps) {
  const { client } = useSmartAccountClient({});
  const user = useUser();
  const { chain } = useChain();
  const address = client?.account?.address || user?.address;

  const { balances, prices, isLoading, error, refetch } = useTokenBalances(
    address,
    chain
  );

  useEffect(() => {
    if (isVisible) {
      void refetch({ background: true });
    }
  }, [isVisible, refetch]);

  useEffect(() => {
    if (refreshKey > 0) {
      void refetch({ background: true });
    }
  }, [refreshKey, refetch]);

  const chainId = chain?.id;

  const tokenRows = TOKEN_ROWS.map((symbol) => {
    const balance = balances[symbol];
    const decimals = TOKEN_INFO[symbol].decimals;
    const formattedAmount =
      balance !== null ? formatTokenBalance(balance, decimals) : "0";
    const usdValue =
      balance !== null
        ? tokenBalanceToUsd(balance, decimals, prices[symbol] ?? 0)
        : 0;

    return { symbol, formattedAmount, usdValue };
  });

  const totalUsd = tokenRows.reduce((sum, row) => sum + row.usdValue, 0);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <span className="text-sm font-medium text-gray-500">Balances</span>
        <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="space-y-2">
          {TOKEN_ROWS.map((symbol) => (
            <div key={symbol} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Image
                  src={getTokenIcon(symbol, chainId)}
                  alt={symbol}
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <span className="text-sm">{symbol}</span>
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <span className="text-sm font-medium text-gray-500">Balances</span>
        <div className="text-sm text-red-500">Error loading balances: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-gray-500">Balances</span>

      <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 mb-1">Total Value</div>
        <div className="text-lg font-semibold">
          {PriceService.formatUSD(totalUsd)}
        </div>
      </div>

      <div className="space-y-1.5">
        {tokenRows.map(({ symbol, formattedAmount, usdValue }) => (
          <div key={symbol} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Image
                src={getTokenIcon(symbol, chainId)}
                alt={symbol}
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-sm">{symbol}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{formattedAmount}</div>
              <div className="text-xs text-gray-500">
                {PriceService.formatUSD(usdValue)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
