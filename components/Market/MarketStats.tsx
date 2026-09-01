"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketStats as MarketStatsType } from '@/app/api/market/tokens/route';
import { TrendingUp, TrendingDown, DollarSign, Coins, BarChart3 } from 'lucide-react';
import { formatEther } from 'viem';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { convertFailingGateway } from '@/lib/utils/image-gateway';
import Link from 'next/link';

interface MarketStatsProps {
  stats: MarketStatsType | null;
  loading?: boolean;
}

export function MarketStats({ stats, loading }: MarketStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted animate-pulse rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatGainerChange = (change?: number) => {
    const value = Math.max(change ?? 0, 0);
    return value > 0 ? `+${value.toFixed(2)}%` : '0.00%';
  };

  const formatLoserChange = (change?: number) => {
    const value = Math.min(change ?? 0, 0);
    return value < 0 ? `${value.toFixed(2)}%` : '0.00%';
  };

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_tokens}</div>
            <p className="text-xs text-muted-foreground">Listed on market</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total TVL</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_tvl)}</div>
            <p className="text-xs text-muted-foreground">Value locked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Volume</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.volume_24h)}</div>
            <p className="text-xs text-muted-foreground">Trading volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg TVL</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_tokens > 0
                ? formatCurrency(stats.total_tvl / stats.total_tokens)
                : '$0'}
            </div>
            <p className="text-xs text-muted-foreground">Per token</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Gainers and Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Gainers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              Top Gainers (24h)
            </CardTitle>
            <CardDescription>Highest price increase</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.top_gainers.length > 0 ? (
              <div className="space-y-3">
                {stats.top_gainers.map((token, index) => (
                  <Link
                    key={token.address}
                    href={token.owner_address ? `/creator/${token.owner_address}` : '#'}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
                        #{index + 1}
                      </div>
                      {token.creator_avatar_url && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage
                            src={convertFailingGateway(token.creator_avatar_url)}
                            alt={token.symbol}
                          />
                          <AvatarFallback className="text-xs">
                            {token.symbol.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{token.symbol}</p>
                        <p className="text-xs text-muted-foreground truncate">{token.name}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {formatGainerChange(token.price_change_24h)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${token.price.toFixed(4)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No gainers data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Losers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              Top Losers (24h)
            </CardTitle>
            <CardDescription>Highest price decrease</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.top_losers.length > 0 ? (
              <div className="space-y-3">
                {stats.top_losers.map((token, index) => (
                  <Link
                    key={token.address}
                    href={token.owner_address ? `/creator/${token.owner_address}` : '#'}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
                        #{index + 1}
                      </div>
                      {token.creator_avatar_url && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage
                            src={convertFailingGateway(token.creator_avatar_url)}
                            alt={token.symbol}
                          />
                          <AvatarFallback className="text-xs">
                            {token.symbol.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{token.symbol}</p>
                        <p className="text-xs text-muted-foreground truncate">{token.name}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {formatLoserChange(token.price_change_24h)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${token.price.toFixed(4)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No losers data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

