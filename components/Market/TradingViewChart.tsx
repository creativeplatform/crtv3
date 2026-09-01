"use client";

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineStyleOptions,
  AreaStyleOptions,
  CandlestickStyleOptions,
  BaselineStyleOptions,
  ColorType,
  HistogramStyleOptions,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  CandlestickSeries,
  BaselineSeries,
} from 'lightweight-charts';
import { useTheme } from 'next-themes';
import {
  convertToChartData,
  convertToCandlestickData,
  convertToVolumeDataFromPriceDirection,
  convertToVolumeDataWithColor,
  getChartColors,
  getLineSeriesOptions,
  getAreaSeriesOptions,
  getBaselineSeriesOptions,
  getPeriodOpenPriceLineOptions,
  getCandlestickSeriesOptions,
  getVolumeSeriesOptions,
  CandlestickDataPoint,
} from '@/lib/utils/chart-utils';
import { PriceHistoryPoint } from '@/app/api/market/tokens/[address]/price-history/route';
import { logger } from '@/lib/utils/logger';

export type ChartType = 'line' | 'area' | 'candlestick' | 'baseline';

interface TradingViewChartProps {
  data: PriceHistoryPoint[];
  chartType?: ChartType;
  showVolume?: boolean;
  /** Period-open price for BaselineSeries; defaults to first data point. */
  basePrice?: number;
  /** Overall period direction for area/line coloring. */
  isPositive?: boolean;
  height?: number;
  width?: number;
  className?: string;
}

type MainSeriesApi = ISeriesApi<'Line' | 'Area' | 'Candlestick' | 'Baseline'>;

export function TradingViewChart({
  data,
  chartType = 'baseline',
  showVolume = false,
  basePrice,
  isPositive,
  height = 400,
  width,
  className,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<MainSeriesApi | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const periodOpenLineRef = useRef<IPriceLine | null>(null);
  const candleDataRef = useRef<CandlestickDataPoint[]>([]);
  const { theme, systemTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  const isDark = theme === 'dark' || (theme === 'system' && systemTheme === 'dark') || false;
  const resolvedBasePrice =
    basePrice ?? (data.length > 0 ? data[0].price : 0);

  const syncPeriodOpenLine = (
    series: MainSeriesApi,
    price: number,
    dark: boolean
  ) => {
    if (!(price > 0)) {
      if (periodOpenLineRef.current) {
        series.removePriceLine(periodOpenLineRef.current);
        periodOpenLineRef.current = null;
      }
      return;
    }

    const options = getPeriodOpenPriceLineOptions(price, dark);
    if (periodOpenLineRef.current) {
      periodOpenLineRef.current.applyOptions(options);
      return;
    }
    periodOpenLineRef.current = series.createPriceLine(options);
  };

  // Mount check for SSR
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!isMounted || !chartContainerRef.current) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      periodOpenLineRef.current = null;
    }

    const colors = getChartColors(isDark);

    const chart = createChart(chartContainerRef.current, {
      width: width || chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: 1, // Normal crosshair
      },
      rightPriceScale: {
        borderColor: colors.grid,
      },
      timeScale: {
        borderColor: colors.grid,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const chartData = convertToChartData(data);
    let series: MainSeriesApi;

    if (chartType === 'baseline') {
      const baselineOptions = getBaselineSeriesOptions(resolvedBasePrice || 0);
      series = chart.addSeries(
        BaselineSeries,
        baselineOptions as BaselineStyleOptions
      );
      series.setData(chartData);
      syncPeriodOpenLine(series, resolvedBasePrice || 0, isDark);
    } else if (chartType === 'area') {
      const areaOptions = getAreaSeriesOptions(isDark, isPositive);
      series = chart.addSeries(AreaSeries, areaOptions as AreaStyleOptions);
      series.setData(chartData);
    } else if (chartType === 'candlestick') {
      const candleOptions = getCandlestickSeriesOptions(isDark);
      series = chart.addSeries(
        CandlestickSeries,
        candleOptions as CandlestickStyleOptions
      );
      const candleData = convertToCandlestickData(data);
      candleDataRef.current = candleData;
      series.setData(candleData);
    } else {
      const lineOptions = getLineSeriesOptions(isDark, isPositive);
      series = chart.addSeries(LineSeries, lineOptions as LineStyleOptions);
      series.setData(chartData);
    }

    seriesRef.current = series;

    if (showVolume && data.length > 0) {
      const volumeData =
        chartType === 'candlestick'
          ? convertToVolumeDataWithColor(data, candleDataRef.current, isDark)
          : convertToVolumeDataFromPriceDirection(data, isDark);
      const volumeOptions = getVolumeSeriesOptions(isDark);

      const volumeSeries = chart.addSeries(HistogramSeries, {
        ...volumeOptions,
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      } as HistogramStyleOptions);

      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries;
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newWidth = width || chartContainerRef.current.clientWidth;
        chartRef.current.applyOptions({ width: newWidth });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          logger.debug('Chart cleanup error:', e);
        }
        chartRef.current = null;
        seriesRef.current = null;
        volumeSeriesRef.current = null;
        periodOpenLineRef.current = null;
      }
    };
    // data intentionally omitted — updated in separate effect to avoid full remounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, height, width, isDark, chartType, showVolume]);

  // Update data when it changes
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    if (chartType === 'candlestick') {
      const candleData = convertToCandlestickData(data);
      candleDataRef.current = candleData;
      seriesRef.current.setData(candleData);
    } else {
      const chartData = convertToChartData(data);
      seriesRef.current.setData(chartData);
      if (chartType === 'baseline') {
        const nextBase = resolvedBasePrice || data[0].price;
        seriesRef.current.applyOptions(
          getBaselineSeriesOptions(nextBase) as BaselineStyleOptions
        );
        syncPeriodOpenLine(seriesRef.current, nextBase, isDark);
      }
    }

    if (showVolume && volumeSeriesRef.current) {
      const volumeData =
        chartType === 'candlestick'
          ? convertToVolumeDataWithColor(data, candleDataRef.current, isDark)
          : convertToVolumeDataFromPriceDirection(data, isDark);
      volumeSeriesRef.current.setData(volumeData);
    }

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, showVolume, chartType, resolvedBasePrice, isDark]);

  // Update theme / period colors when they change
  useEffect(() => {
    if (!chartRef.current) return;

    const colors = getChartColors(isDark);
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
    });

    if (seriesRef.current) {
      if (chartType === 'baseline') {
        seriesRef.current.applyOptions(
          getBaselineSeriesOptions(resolvedBasePrice || 0) as BaselineStyleOptions
        );
        syncPeriodOpenLine(seriesRef.current, resolvedBasePrice || 0, isDark);
      } else if (chartType === 'area') {
        seriesRef.current.applyOptions(
          getAreaSeriesOptions(isDark, isPositive) as AreaStyleOptions
        );
      } else if (chartType === 'candlestick') {
        seriesRef.current.applyOptions(
          getCandlestickSeriesOptions(isDark) as CandlestickStyleOptions
        );
      } else {
        seriesRef.current.applyOptions(
          getLineSeriesOptions(isDark, isPositive) as LineStyleOptions
        );
      }
    }
  }, [isDark, chartType, isPositive, resolvedBasePrice]);

  if (!isMounted) {
    return (
      <div
        ref={chartContainerRef}
        className={className}
        style={{ height, width: width || '100%' }}
      />
    );
  }

  return (
    <div
      ref={chartContainerRef}
      className={className}
      style={{ height, width: width || '100%', position: 'relative' }}
    />
  );
}
