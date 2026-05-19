"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  convertFailingGateway,
  extractIpfsHash,
  getImageUrlWithFallback,
  isIpfsUrl,
  resolveOrbMediaForGateway,
} from '@/lib/utils/image-gateway';
import { Skeleton } from '@/components/ui/skeleton';
import type { ImageProps } from 'next/image';
import { logger } from '@/lib/utils/logger';


interface GatewayImageProps extends Omit<ImageProps, 'src' | 'onLoad'> {
  src: string;
  fallbackSrc?: string;
  showSkeleton?: boolean;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

/**
 * Enhanced Image component that automatically handles IPFS gateway fallbacks
 * Converts failing gateways (Lighthouse, etc.) to alternative gateways
 * Uses unoptimized for IPFS images to avoid Next.js optimization timeouts
 * Shows skeleton loader while image loads
 */
export function GatewayImage({
  src,
  fallbackSrc,
  onError,
  unoptimized,
  showSkeleton = true,
  className,
  onLoad: onLoadProp,
  ...props
}: GatewayImageProps) {
  const { fill } = props;
  const normalizeSrc = (raw: string) => {
    if (!raw) return raw;
    const orb = resolveOrbMediaForGateway(raw);
    return convertFailingGateway(orb);
  };

  const [imageSrc, setImageSrc] = useState(() => normalizeSrc(src));
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Track which gateways have been tried to avoid retrying them
  const triedGatewaysRef = useRef<Set<string>>(new Set());
  // Track if all gateways have been exhausted to prevent infinite retries
  const allGatewaysExhaustedRef = useRef(false);
  // Track consecutive failures to detect if content doesn't exist (404 from all gateways)
  const consecutiveFailuresRef = useRef(0);
  const loggedAllGatewaysFailedRef = useRef(false);

  // Sync imageSrc state when src prop changes (e.g., when parent updates thumbnailUrl)
  useEffect(() => {
    // Convert failing gateways when src prop changes
    const convertedSrc = normalizeSrc(src || '');
    
    // Update imageSrc when src prop changes and reset fallback state
    setImageSrc(convertedSrc);
    setFallbackIndex(0);
    setHasError(false);
    setIsLoading(true);
    // Reset tried gateways when src changes
    triedGatewaysRef.current = new Set();
    // Reset exhausted flag when src changes
    allGatewaysExhaustedRef.current = false;
    // Reset failure counter when src changes
    consecutiveFailuresRef.current = 0;
    loggedAllGatewaysFailedRef.current = false;
    // Mark the initial converted src as tried since we're using it
    if (convertedSrc) {
      triedGatewaysRef.current.add(convertedSrc);
    }
  }, [src]);

  // Calculate fallbacks once when src changes and exclude the initial gateway
  // This prevents recalculating and filtering on every render, which was causing
  // gateways to be skipped as imageSrc changed
  const fallbacks = useMemo(() => {
    const { primary, fallbacks: allFallbacks } = getImageUrlWithFallback(src);
    const initialSrc = src && convertFailingGateway(src) !== src 
      ? convertFailingGateway(src) 
      : (src || '');
    
    // Filter out the initial gateway (to avoid retrying it) and any already tried
    // We calculate this once based on src, not on every render based on imageSrc
    return allFallbacks.filter(fallback => {
      // Exclude the initial converted gateway
      if (fallback === initialSrc) {
        return false;
      }
      // Exclude primary if it matches initial src (safety check)
      if (fallback === primary && primary === initialSrc) {
        return false;
      }
      return true;
    });
  }, [src]);

  const isIpfs = isIpfsUrl(imageSrc);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Prevent infinite retries if all gateways have been exhausted
    if (allGatewaysExhaustedRef.current) {
      setIsLoading(false);
      if (onError) {
        onError(e);
      }
      return;
    }

    // Increment failure counter
    consecutiveFailuresRef.current += 1;

    // Mark the current gateway as tried
    if (imageSrc) {
      triedGatewaysRef.current.add(imageSrc);
    }

    // Find the next gateway that hasn't been tried yet
    const nextGateway = fallbacks.find(fallback => !triedGatewaysRef.current.has(fallback));

    if (nextGateway) {
      const triedCount = triedGatewaysRef.current.size;
      logger.debug(`Trying fallback gateway ${triedCount}/${fallbacks.length + 1} for IPFS image:`, nextGateway);
      
      // One-time hint after the second failure (avoid spam on every further hop)
      if (consecutiveFailuresRef.current === 2 && isIpfs) {
        const hash = extractIpfsHash(src) ?? 'unknown';
        logger.warn(
          `[GatewayImage] Multiple gateways failed for IPFS hash ${hash.slice(0, 10)}… — content may be unpinned or gateways blocked.`
        );
      }
      
      // Mark it as tried before setting it as the new source
      triedGatewaysRef.current.add(nextGateway);
      setImageSrc(nextGateway);
      setFallbackIndex((prev) => prev + 1);
      setIsLoading(true); // Reset loading state for new URL
      return;
    }

    // All fallback gateways have been exhausted
    allGatewaysExhaustedRef.current = true;

    // If all fallbacks exhausted, try the fallbackSrc prop
    if (fallbackSrc && imageSrc !== fallbackSrc && !hasError) {
      setHasError(true);
      setImageSrc(fallbackSrc);
      setIsLoading(true); // Reset loading state for new URL
      if (isIpfs && consecutiveFailuresRef.current >= 2) {
        const hash = extractIpfsHash(src) ?? 'unknown';
        logger.debug(
          `[GatewayImage] All IPFS gateways failed for ${hash.slice(0, 12)}…; using fallbackSrc.`
        );
      }
      return;
    }

    // All options exhausted - stop trying (warn once; not console.error — avoids dev stack noise)
    setIsLoading(false);
    if (
      isIpfs &&
      consecutiveFailuresRef.current >= 2 &&
      !loggedAllGatewaysFailedRef.current
    ) {
      loggedAllGatewaysFailedRef.current = true;
      const hash = extractIpfsHash(src) ?? 'unknown';
      logger.warn(
        `[GatewayImage] All IPFS gateways failed for ${hash}. Content may be unpinned; re-upload or pin publicly if needed.`
      );
    }

    // Call original onError handler if provided
    if (onError) {
      onError(e);
    }
  };

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false);
    if (onLoadProp) {
      onLoadProp(event);
    }
  };

  // Use unoptimized for IPFS images to avoid Next.js optimization timeouts
  // IPFS images are already optimized and don't need Next.js processing
  // Blob URLs (local previews) must also be unoptimized as Next.js cannot optimize them
  const isBlob = imageSrc?.startsWith('blob:');
  const shouldUnoptimize = unoptimized !== undefined ? unoptimized : (isIpfs || isBlob);

  return (
    <div className={`relative ${fill ? 'w-full h-full' : ''}`}>
      {showSkeleton && isLoading && (
        <Skeleton className={className || "w-full h-full absolute inset-0"} />
      )}
      <Image
        src={imageSrc}
        onError={handleError}
        onLoad={handleLoad}
        unoptimized={shouldUnoptimize}
        className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'
          } ${className || ''}`}
        {...props}
      />
    </div>
  );
}

