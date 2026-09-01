"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useMeTokensSupabase } from "@/lib/hooks/metokens/useMeTokensSupabase";
import { useMeTokenHoldings } from "@/lib/hooks/metokens/useMeTokenHoldings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, ExternalLink, Wallet, Users, Crown } from "lucide-react";
import Link from "next/link";
import { MeTokenPortfolio } from "./MeTokenPortfolio";
import { useSmartAccountClient, useUser } from "@/lib/wallet/react";
import { useMemo, useState } from "react";
import { formatMeTokenHoldingUsd } from "@/lib/utils/meTokenHoldingValue";
import { mergeHoldingsWithOwnMeToken } from "@/lib/utils/meTokenPortfolioHoldings";

function formatBalance(balance: string, symbol: string): string {
  const num = parseFloat(balance);
  if (num === 0) return `0 ${symbol}`;

  if (num < 0.00001) return `${num.toExponential(5)} ${symbol}`;

  const [integerPart, decimalPart = ""] = balance.split(".");

  if (decimalPart.length <= 5) {
    const cleanDecimal = decimalPart.replace(/0+$/, "");
    return cleanDecimal
      ? `${integerPart}.${cleanDecimal} ${symbol}`
      : `${integerPart} ${symbol}`;
  }

  const truncatedDecimal = decimalPart.slice(0, 5).replace(/0+$/, "");
  return truncatedDecimal
    ? `${integerPart}.${truncatedDecimal} ${symbol}`
    : `${integerPart} ${symbol}`;
}

export function MeTokenBalances() {
  const { address: scaAddress } = useSmartAccountClient({});
  const user = useUser();
  const [showPortfolio, setShowPortfolio] = useState(false);
  const maxVisibleItems = 3;

  const { userMeToken, loading: meTokenLoading, error: meTokenError } = useMeTokensSupabase();
  const { holdings, loading: holdingsLoading, error: holdingsError, refreshHoldings } =
    useMeTokenHoldings();

  const ownerAddress = scaAddress || user?.address || "";

  const allMeTokens = useMemo(
    () => mergeHoldingsWithOwnMeToken(holdings ?? [], userMeToken, ownerAddress),
    [holdings, userMeToken, ownerAddress]
  );

  const portfolioTotal = useMemo(
    () => allMeTokens.reduce((sum, t) => sum + (t.holdingValueUsd || 0), 0),
    [allMeTokens]
  );

  const totalCount = allMeTokens.length;
  const visibleMeTokens = allMeTokens.slice(0, maxVisibleItems);
  const hasMore = totalCount > maxVisibleItems;
  const uniqueCreators = new Set(allMeTokens.map((t) => t.ownerAddress.toLowerCase())).size;
  const isLoading = meTokenLoading || holdingsLoading;
  const error = meTokenError || holdingsError;

  if (showPortfolio) {
    return (
      <MeTokenPortfolio
        holdingsOverride={allMeTokens}
        onBack={() => setShowPortfolio(false)}
        onRefresh={async () => {
          await refreshHoldings(true);
        }}
      />
    );
  }

  if (isLoading && holdings.length === 0 && !userMeToken) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">MeToken Portfolio</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    );
  }

  if (error && totalCount === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">MeToken Portfolio</span>
        </div>
        <div className="text-xs text-red-500">Error loading MeTokens: {error}</div>
      </div>
    );
  }

  if (!isLoading && totalCount === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-500">MeToken Portfolio</span>
          <span className="text-xs text-gray-400">
            {totalCount} MeToken{totalCount !== 1 ? "s" : ""} • {uniqueCreators}{" "}
            Creator{uniqueCreators !== 1 ? "s" : ""}
          </span>
        </div>
        {totalCount > maxVisibleItems && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPortfolio(true)}
            className="text-xs h-6 px-2"
          >
            <Wallet className="h-3 w-3 mr-1" />
            View All
          </Button>
        )}
      </div>

      <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 mb-1">Est. value</div>
        <div className="text-lg font-semibold">{formatMeTokenHoldingUsd(portfolioTotal)}</div>
      </div>

      <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
        {visibleMeTokens.map((token) => (
          <Link
            key={token.address}
            href={
              token.isOwnMeToken
                ? `/profile/${scaAddress || user?.address}`
                : `/creator/${token.ownerAddress}`
            }
            className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Coins className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{token.symbol}</span>
                {token.isOwnMeToken ? (
                  <Badge variant="default" className="text-xs px-1 py-0 bg-primary flex-shrink-0">
                    <Crown className="h-2 w-2 mr-0.5" />
                    Yours
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs px-1 py-0 flex-shrink-0">
                    <Users className="h-2 w-2 mr-0.5" />
                    Held
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <div className="text-sm font-medium">
                {formatBalance(token.balance, token.symbol)}
              </div>
              <div className="text-xs text-gray-500">
                {formatMeTokenHoldingUsd(token.holdingValueUsd)}
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
          </Link>
        ))}

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPortfolio(true)}
            className="w-full text-xs h-7 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            View {totalCount - maxVisibleItems} more...
          </Button>
        )}
      </div>
    </div>
  );
}
