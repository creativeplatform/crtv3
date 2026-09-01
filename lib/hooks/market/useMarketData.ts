import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketToken, MarketStats } from '@/app/api/market/tokens/route';
import { useMarketRealtime } from './useMarketRealtime';
import { logger } from '@/lib/utils/logger';


export interface MarketFilters {
  type: 'all' | 'metoken' | 'content_coin';
  search: string;
  sortBy: 'price' | 'tvl' | 'market_cap' | 'volume_24h' | 'price_change_24h' | 'created_at';
  sortOrder: 'asc' | 'desc';
}

export interface UseMarketDataOptions {
  filters?: Partial<MarketFilters>;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseMarketDataResult {
  tokens: MarketToken[];
  stats: MarketStats | null;
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filters: MarketFilters;
  setFilters: (filters: Partial<MarketFilters>) => void;
  setPage: (page: number) => void;
  refresh: () => Promise<void>;
}

const defaultFilters: MarketFilters = {
  type: 'all',
  search: '',
  sortBy: 'tvl',
  sortOrder: 'desc',
};

export function useMarketData(options: UseMarketDataOptions = {}): UseMarketDataResult {
  const {
    filters: initialFilters = {},
    limit = 50,
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit,
    offset: 0,
    hasMore: false,
  });
  const [filters, setFiltersState] = useState<MarketFilters>({
    ...defaultFilters,
    ...initialFilters,
  });
  const [currentPage, setCurrentPage] = useState(0);

  const fetchMarketData = useCallback(async (isBackground = false, useFresh = false) => {
    if (!isBackground) {
      setLoading(true);
      setError(null);
    }

    try {
      const params = new URLSearchParams({
        type: filters.type,
        search: filters.search,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        limit: limit.toString(),
        offset: (currentPage * limit).toString(),
        includeStats: 'true',
      });

      if (useFresh) {
        params.set('fresh', 'true');
        params.set('_t', Date.now().toString());
      }

      const response = await fetch(`/api/market/tokens?${params.toString()}`, {
        cache: useFresh ? 'no-store' : 'default',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch market data: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setTokens(data.data || []);
      setStats(data.stats || null);
      setPagination({
        total: data.pagination?.total || 0,
        limit: data.pagination?.limit || limit,
        offset: data.pagination?.offset || 0,
        hasMore: data.pagination?.hasMore || false,
      });
    } catch (err) {
      logger.error('Error fetching market data:', err);
      // Only set error if it's not a background refresh (to avoid annoying transient errors)
      if (!isBackground) {
        setError(err instanceof Error ? err.message : 'Failed to fetch market data');
        setTokens([]);
        setStats(null);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [filters.type, filters.search, filters.sortBy, filters.sortOrder, currentPage, limit]);

  // Debounce search input
  useEffect(() => {
    if (filters.search) {
      const timeoutId = setTimeout(() => {
        setCurrentPage(0); // Reset to first page on search
        fetchMarketData();
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    } else {
      setCurrentPage(0);
      fetchMarketData();
    }
  }, [filters.search, fetchMarketData]);

  // Fetch when filters change (except search, which is handled above)
  useEffect(() => {
    if (!filters.search) {
      setCurrentPage(0);
      fetchMarketData();
    }
  }, [filters.type, filters.sortBy, filters.sortOrder, fetchMarketData]);

  // Fetch when page changes
  useEffect(() => {
    if (filters.search) {
      // Search debounce handles this
      return;
    }
    fetchMarketData();
  }, [currentPage, filters.search, fetchMarketData]);

  // Auto-refresh - use ref to track if we should refresh
  const shouldRefreshRef = useRef(true);

  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      // Only refresh if not currently loading to avoid overlapping requests
      if (shouldRefreshRef.current) {
        fetchMarketData(true);
      }
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchMarketData]);

  // Track loading state
  useEffect(() => {
    shouldRefreshRef.current = !loading;
  }, [loading]);

  const setFilters = useCallback((newFilters: Partial<MarketFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const refresh = useCallback(async () => {
    await fetchMarketData(false, true);
  }, [fetchMarketData]);

  // Debounce ref for global refresh
  const globalRefreshTimeoutRef = useRef<any>(null);

  // Real-time updates
  const handleRealtimeUpdate = useCallback(async (tokenAddress: string) => {
    logger.debug(`⚡ Real-time update for ${tokenAddress}`);

    try {
      // 1. Fetch fresh data for this specific token immediately (fast UI update for the token)
      const response = await fetch(`/api/market/tokens/${tokenAddress}/fresh`);
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          setTokens(prevTokens =>
            prevTokens.map(t =>
              t.address.toLowerCase() === tokenAddress.toLowerCase()
                ? { ...t, ...result.data } // Merge fresh data
                : t
            )
          );
        }
      }

      // 2. Schedule a global refresh to update "stats" (Top Gainers/Losers, Total TVL/Volume)
      // We debounce this to avoid hammering the API if multiple tokens update at once (e.g. during high activity)
      if (globalRefreshTimeoutRef.current) {
        clearTimeout(globalRefreshTimeoutRef.current);
      }

      globalRefreshTimeoutRef.current = setTimeout(() => {
        logger.debug('⚡ Triggering global market data refresh from real-time event');
        fetchMarketData(true, true);
      }, 2000);

    } catch (error) {
      logger.error('Failed to fetch fresh token data:', error);
    }
  }, [fetchMarketData]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (globalRefreshTimeoutRef.current) {
        clearTimeout(globalRefreshTimeoutRef.current);
      }
    };
  }, []);

  useMarketRealtime(tokens, {
    enabled: autoRefresh,
    onUpdate: handleRealtimeUpdate
  });

  return {
    tokens,
    stats,
    loading,
    error,
    pagination,
    filters,
    setFilters,
    setPage,
    refresh,
  };
}

