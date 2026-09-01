"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriceHistoryPoint } from '@/app/api/market/tokens/[address]/price-history/route';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import { TradingViewChart } from './TradingViewChart';
import { logger } from '@/lib/utils/logger';


interface TokenPriceChartProps {
  tokenAddress: string;
  tokenSymbol?: string;
  className?: string;
  height?: number;
  showControls?: boolean;
}

export function TokenPriceChart({
  tokenAddress,
  tokenSymbol,
  className,
  height = 200,
  showControls = true,
}: TokenPriceChartProps) {
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [data, setData] = useState<PriceHistoryPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch price history
  useEffect(() => {
    const fetchData = async () => {
      if (!tokenAddress) {
        setData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const url = `/api/market/tokens/${encodeURIComponent(tokenAddress)}/price-history?period=${period}&interval=${period === '7d' ? 'hour' : 'day'}`;
        const response = await fetch(url);

        if (!response.ok) {
          let errorMessage = `Failed to fetch price history (${response.status})`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If JSON parsing fails, use default message
          }

          // For 404, just return empty data (token might not have transactions yet)
          if (response.status === 404) {
            logger.debug('Token not found or no price history available');
            setData([]);
            setCurrentPrice(null);
            setError(null);
            return;
          }

          throw new Error(errorMessage);
        }

        const result = await response.json();
        logger.debug('📊 Price History API Response:', result);
        logger.debug('📈 History Data Points:', result.data?.length || 0);
        logger.debug('💰 Current Price from API:', result.token?.current_price);

        setData(result.data || []);
        setCurrentPrice(result.token?.current_price || null);
      } catch (err) {
        logger.error('Error fetching price history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chart');
        setData([]); // Set empty data on error
        setCurrentPrice(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tokenAddress, period]);

  // Calculate price change for display (neutral when flat)
  const priceInfo = useMemo(() => {
    logger.debug('🔍 Calculating priceInfo:', {
      dataLength: data.length,
      currentPrice,
      firstDataPoint: data[0],
      lastDataPoint: data[data.length - 1]
    });

    if (data.length === 0) {
      // If no data but we have currentPrice from API, use it (no period change)
      if (currentPrice !== null && currentPrice > 0) {
        return {
          lastPrice: currentPrice,
          priceChange: 0,
          isPositive: false,
          isNeutral: true,
          basePrice: currentPrice,
        };
      }
      return null;
    }

    const firstPrice = data[0]?.price || 0;
    const lastPrice = data[data.length - 1]?.price || 0;

    logger.debug('💵 Price values:', { firstPrice, lastPrice, currentPrice });

    // If lastPrice is 0 but we have currentPrice from API, use that instead
    const displayPrice = (lastPrice > 0) ? lastPrice : (currentPrice || 0);

    const priceChange = firstPrice > 0 ? ((displayPrice - firstPrice) / firstPrice) * 100 : 0;
    const isNeutral = priceChange === 0;
    const isPositive = priceChange > 0;

    return {
      lastPrice: displayPrice,
      priceChange,
      isPositive,
      isNeutral,
      basePrice: firstPrice,
    };
  }, [data, currentPrice]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">
                {tokenSymbol ? `${tokenSymbol} Price` : 'Price Chart'}
              </CardTitle>
              <CardDescription className="text-xs">
                {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : 'All Time'}
              </CardDescription>
            </div>
            {showControls && (
              <div className="flex gap-1">
                <Button
                  variant={period === '7d' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriod('7d')}
                  className="h-7 text-xs"
                >
                  7D
                </Button>
                <Button
                  variant={period === '30d' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriod('30d')}
                  className="h-7 text-xs"
                >
                  30D
                </Button>
                <Button
                  variant={period === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriod('all')}
                  className="h-7 text-xs"
                >
                  ALL
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center" style={{ height }}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {tokenSymbol ? `${tokenSymbol} Price` : 'Price Chart'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground" style={{ height }}>
          {error}
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {tokenSymbol ? `${tokenSymbol} Price` : 'Price Chart'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground" style={{ height }}>
          No chart data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">
              {tokenSymbol ? `${tokenSymbol} Price` : 'Price Chart'}
            </CardTitle>
            <CardDescription className="text-xs">
              {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : 'All Time'}
            </CardDescription>
          </div>
          {showControls && (
            <div className="flex gap-1">
              <Button
                variant={period === '7d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod('7d')}
                className="h-7 text-xs"
              >
                7D
              </Button>
              <Button
                variant={period === '30d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod('30d')}
                className="h-7 text-xs"
              >
                30D
              </Button>
              <Button
                variant={period === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod('all')}
                className="h-7 text-xs"
              >
                ALL
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Price Info */}
          {priceInfo && (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                ${priceInfo.lastPrice.toFixed(4)}
              </span>
              <span
                className={cn(
                  'text-sm font-medium',
                  priceInfo.isNeutral
                    ? 'text-muted-foreground'
                    : priceInfo.isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                )}
              >
                {priceInfo.isPositive ? '+' : ''}
                {priceInfo.priceChange.toFixed(2)}%
              </span>
            </div>
          )}

          {/* TradingView Chart — baseline shows green above / red below period open */}
          <div className="relative" style={{ width: '100%', height }}>
            <TradingViewChart
              data={data}
              chartType="baseline"
              showVolume={true}
              basePrice={priceInfo?.basePrice}
              isPositive={priceInfo?.isNeutral ? undefined : priceInfo?.isPositive}
              height={height}
              className="w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

