"use client";

import { useState } from 'react';
import { useMarketData } from '@/lib/hooks/market/useMarketData';
import { MarketStats } from '@/components/Market/MarketStats';
import { MarketFilters } from '@/components/Market/MarketFilters';
import { TokenList } from '@/components/Market/TokenList';
import { QuickTradeDialog } from '@/components/Market/QuickTradeDialog';
import { MarketToken } from '@/app/api/market/tokens/route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function MarketPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [quickTradeOpen, setQuickTradeOpen] = useState(false);

  const {
    tokens,
    stats,
    loading,
    error,
    pagination,
    filters,
    setFilters,
    setPage,
    refresh,
  } = useMarketData({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
  });

  const handleQuickTrade = (token: MarketToken) => {
    setSelectedToken(token);
    setQuickTradeOpen(true);
  };

  const handleTradeComplete = () => {
    // Refresh market data after trade
    refresh();
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Trading Market</h1>
        </div>
        <p className="text-muted-foreground">
          Discover and trade MeTokens and Content Coins
        </p>
      </div>

      {/* Market Stats */}
      <MarketStats stats={stats} loading={loading} />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>
            Search, filter, and sort tokens to find what you're looking for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MarketFilters filters={filters} onFiltersChange={setFilters} />
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-2">
              <p className="text-destructive font-medium">Error loading market data</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={() => refresh()}
                className="text-sm text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Token List */}
      {!error && (
        <TokenList
          tokens={tokens}
          loading={loading}
          pagination={pagination}
          currentPage={Math.floor(pagination.offset / pagination.limit)}
          onPageChange={(page) => setPage(page)}
          onQuickTrade={handleQuickTrade}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}

      {/* Quick Trade Dialog */}
      <QuickTradeDialog
        open={quickTradeOpen}
        onOpenChange={setQuickTradeOpen}
        onTradeComplete={handleTradeComplete}
        token={selectedToken}
      />
    </div>
  );
}

