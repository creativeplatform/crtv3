import { PriceHistoryPoint } from '@/app/api/market/tokens/[address]/price-history/route';
import {
  LineStyle,
  type LineStyleOptions,
  type AreaStyleOptions,
  type CandlestickStyleOptions,
  type HistogramStyleOptions,
  type BaselineStyleOptions,
  type CreatePriceLineOptions,
  type UTCTimestamp,
  type Time,
  type LineData,
  type AreaData,
  type HistogramData,
} from 'lightweight-charts';

// Use the actual types from lightweight-charts
export type ChartDataPoint = LineData<Time> | AreaData<Time>;
export type VolumeDataPoint = HistogramData<Time>;

export interface CandlestickDataPoint {
  time: UTCTimestamp; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export const CHART_UP = '#22c55e';
export const CHART_DOWN = '#ef4444';

/**
 * Convert price history data to lightweight-charts format
 */
export function convertToChartData(priceHistory: PriceHistoryPoint[]): ChartDataPoint[] {
  return priceHistory.map((point) => ({
    time: point.timestamp as UTCTimestamp,
    value: point.price,
  } as LineData<Time>));
}

/**
 * Convert price history to candlestick format
 * Note: This creates synthetic OHLC from price data
 * For real candlesticks, you'd need actual OHLC data
 */
export function convertToCandlestickData(priceHistory: PriceHistoryPoint[]): CandlestickDataPoint[] {
  if (priceHistory.length === 0) return [];

  // Group by time period (hour/day) to create candles
  const candles: CandlestickDataPoint[] = [];
  const grouped = new Map<number, PriceHistoryPoint[]>();

  // Group points by hour (for hourly data) or day (for daily data)
  for (const point of priceHistory) {
    const timeKey = Math.floor(point.timestamp / 3600) * 3600; // Round to hour
    if (!grouped.has(timeKey)) {
      grouped.set(timeKey, []);
    }
    grouped.get(timeKey)!.push(point);
  }

  // Create candles from grouped data
  for (const [timeKey, points] of grouped.entries()) {
    const prices = points.map((p) => p.price);
    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    candles.push({
      time: timeKey as UTCTimestamp,
      open,
      high,
      low,
      close,
    });
  }

  return candles.sort((a, b) => a.time - b.time);
}

/**
 * Convert volume data to lightweight-charts format with candlestick-derived colors.
 * Falls back to comparing each point's price to the previous point when no exact
 * candle timestamp match exists, so volume bars still show correct directionality.
 */
export function convertToVolumeDataWithColor(
  priceHistory: PriceHistoryPoint[],
  candles?: CandlestickDataPoint[],
  isDark: boolean = false
): VolumeDataPoint[] {
  if (!candles || candles.length === 0) {
    return convertToVolumeData(priceHistory);
  }

  const colors = getChartColors(isDark);
  const candleMap = new Map<number, CandlestickDataPoint>(
    candles.map((c) => [c.time, c])
  );

  return priceHistory.map((point, index) => {
    const timeKey = Math.floor(point.timestamp / 3600) * 3600;
    const candle = candleMap.get(timeKey as UTCTimestamp);
    let isUp: boolean;
    if (candle) {
      isUp = candle.close >= candle.open;
    } else if (index > 0) {
      // Fallback: compare to previous price point
      isUp = point.price >= priceHistory[index - 1].price;
    } else {
      isUp = true;
    }

    return {
      time: point.timestamp as UTCTimestamp,
      value: point.volume,
      color: isUp ? colors.volumeUp : colors.volumeDown,
    } as HistogramData<Time>;
  });
}

/**
 * Color volume bars from consecutive price moves (for baseline/area charts).
 */
export function convertToVolumeDataFromPriceDirection(
  priceHistory: PriceHistoryPoint[],
  isDark: boolean = false
): VolumeDataPoint[] {
  const colors = getChartColors(isDark);
  return priceHistory.map((point, index) => {
    const isUp =
      index === 0
        ? true
        : point.price >= priceHistory[index - 1].price;
    return {
      time: point.timestamp as UTCTimestamp,
      value: point.volume,
      color: isUp ? colors.volumeUp : colors.volumeDown,
    } as HistogramData<Time>;
  });
}

/**
 * Convert volume data to lightweight-charts format
 * (uncolored fallback for line/area charts)
 */
export function convertToVolumeData(priceHistory: PriceHistoryPoint[]): VolumeDataPoint[] {
  return priceHistory.map((point) => ({
    time: point.timestamp as UTCTimestamp,
    value: point.volume,
  } as HistogramData<Time>));
}

/**
 * Get chart colors based on theme
 */
export function getChartColors(isDark: boolean): {
  background: string;
  text: string;
  grid: string;
  line: string;
  areaTop: string;
  areaBottom: string;
  volumeUp: string;
  volumeDown: string;
  up: string;
  down: string;
} {
  if (isDark) {
    return {
      background: '#1a1a1a',
      text: '#d1d5db',
      grid: '#374151',
      line: '#3b82f6',
      areaTop: 'rgba(59, 130, 246, 0.5)',
      areaBottom: 'rgba(59, 130, 246, 0.05)',
      volumeUp: 'rgba(34, 197, 94, 0.5)',
      volumeDown: 'rgba(239, 68, 68, 0.5)',
      up: CHART_UP,
      down: CHART_DOWN,
    };
  }
  return {
    background: '#ffffff',
    text: '#1f2937',
    grid: '#e5e7eb',
    line: '#3b82f6',
    areaTop: 'rgba(59, 130, 246, 0.5)',
    areaBottom: 'rgba(59, 130, 246, 0.05)',
    volumeUp: 'rgba(34, 197, 94, 0.5)',
    volumeDown: 'rgba(239, 68, 68, 0.5)',
    up: CHART_UP,
    down: CHART_DOWN,
  };
}

/**
 * Period-colored line (green gain / red loss vs period open).
 */
export function getLineSeriesOptions(
  isDark: boolean,
  isPositive?: boolean
): Partial<LineStyleOptions> {
  const colors = getChartColors(isDark);
  const color =
    isPositive === undefined
      ? colors.line
      : isPositive
        ? colors.up
        : colors.down;
  return {
    color,
    lineWidth: 2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
  };
}

/**
 * Period-colored area (green gain / red loss vs period open).
 */
export function getAreaSeriesOptions(
  isDark: boolean,
  isPositive?: boolean
): Partial<AreaStyleOptions> {
  const colors = getChartColors(isDark);
  const positive = isPositive !== false;
  const lineColor =
    isPositive === undefined
      ? colors.line
      : positive
        ? colors.up
        : colors.down;
  const topColor =
    isPositive === undefined
      ? colors.areaTop
      : positive
        ? 'rgba(34, 197, 94, 0.4)'
        : 'rgba(239, 68, 68, 0.4)';
  const bottomColor =
    isPositive === undefined
      ? colors.areaBottom
      : positive
        ? 'rgba(34, 197, 94, 0.05)'
        : 'rgba(239, 68, 68, 0.05)';

  return {
    lineColor,
    topColor,
    bottomColor,
    lineWidth: 2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
  };
}

/**
 * Baseline series: green above / red below period open (best PnL visualization).
 */
export function getBaselineSeriesOptions(
  basePrice: number
): Partial<BaselineStyleOptions> {
  return {
    baseValue: { type: 'price', price: basePrice },
    relativeGradient: true,
    topLineColor: CHART_UP,
    topFillColor1: 'rgba(34, 197, 94, 0.35)',
    topFillColor2: 'rgba(34, 197, 94, 0.05)',
    bottomLineColor: CHART_DOWN,
    bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
    bottomFillColor2: 'rgba(239, 68, 68, 0.35)',
    lineWidth: 2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
  };
}

/**
 * Labeled price line at period open (createPriceLine cue for baseline charts).
 */
export function getPeriodOpenPriceLineOptions(
  basePrice: number,
  isDark: boolean
): CreatePriceLineOptions {
  return {
    price: basePrice,
    color: isDark ? '#9ca3af' : '#6b7280',
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: 'Period open',
  };
}

/**
 * Get candlestick series options with matching wick/border colors.
 */
export function getCandlestickSeriesOptions(
  _isDark: boolean
): Partial<CandlestickStyleOptions> {
  return {
    upColor: CHART_UP,
    downColor: CHART_DOWN,
    borderVisible: true,
    borderUpColor: CHART_UP,
    borderDownColor: CHART_DOWN,
    wickVisible: true,
    wickUpColor: CHART_UP,
    wickDownColor: CHART_DOWN,
  };
}

/**
 * Get volume histogram options
 */
export function getVolumeSeriesOptions(isDark: boolean): Partial<HistogramStyleOptions> {
  const colors = getChartColors(isDark);
  return {
    color: colors.volumeUp,
  };
}

/**
 * Format timestamp for display
 */
export function formatTime(timestamp: number, period: '7d' | '30d' | 'all'): string {
  const date = new Date(timestamp * 1000);

  if (period === '7d') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (period === '30d') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
