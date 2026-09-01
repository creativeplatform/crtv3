"use client";
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { getThumbnailUrl } from '@/lib/utils/thumbnail';
import { fetchVideoAssetByPlaybackId } from '@/lib/utils/video-assets-client';
import { Player } from '@/components/Player/Player';
import { PlayIcon, Volume2, VolumeX } from 'lucide-react';
import { Src } from '@livepeer/react';
import { convertFailingGateway, isIpfsUrl, getAllIpfsGateways } from '@/lib/utils/image-gateway';
import { Skeleton } from '@/components/ui/skeleton';
import { GatewayImage } from '@/components/ui/gateway-image';
import { logger } from '@/lib/utils/logger';

interface VideoThumbnailProps {
  playbackId: string;
  src: Src[] | null;
  title: string;
  assetId?: string;
  /** When provided (e.g. from list response), used immediately to avoid extra fetch and improve display */
  initialThumbnailUrl?: string;
  onPlay?: () => void;
  /** Prefetch Livepeer playback sources (hover / intent) when parent defers fetch */
  onRequestPlayback?: () => void;
  className?: string;
  enablePreview?: boolean;
  priority?: boolean; // If true, uses loading="eager" for above-the-fold images (LCP optimization)
  hidePlayOverlay?: boolean; // If true, hides the play button overlay
}

const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  playbackId,
  src,
  title,
  assetId,
  initialThumbnailUrl,
  onPlay,
  onRequestPlayback,
  className = "",
  enablePreview = false,
  priority = false,
  hidePlayOverlay = false
}) => {
  const hasInitial = Boolean(initialThumbnailUrl && initialThumbnailUrl.trim() !== "");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() =>
    hasInitial ? convertFailingGateway(initialThumbnailUrl!.trim()) : null
  );
  const [isLoading, setIsLoading] = useState(!hasInitial);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const showPlayerRef = React.useRef(showPlayer);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const thumbnailCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    async function fetchThumbnail() {
      if (!playbackId) {
        setIsLoading(false);
        return;
      }

      // Use initialThumbnailUrl when provided to avoid extra fetch and show immediately
      if (hasInitial && initialThumbnailUrl?.trim()) {
        const converted = convertFailingGateway(initialThumbnailUrl.trim());
        // Cache the successful thumbnail URL
        thumbnailCacheRef.current.set(playbackId, converted);
        setThumbnailUrl(converted);
        setIsLoading(false);
        return;
      }

      // Check cache first
      const cachedUrl = thumbnailCacheRef.current.get(playbackId);
      if (cachedUrl) {
        logger.debug(`[Thumbnail] ${title || playbackId} - Using cached thumbnail URL`);
        setThumbnailUrl(cachedUrl);
        setIsLoading(false);
        return;
      }

      const startTime = performance.now();
      const videoTitle = title || playbackId;

      try {
        setIsLoading(true);

        // First, try to get thumbnail from database
        // Declare dbStartTime outside try block so it's accessible in catch block
        const dbStartTime = performance.now();
        try {
          const dbAsset = await fetchVideoAssetByPlaybackId(playbackId);
          const dbTime = performance.now() - dbStartTime;
          
          if (dbAsset && (dbAsset as any).thumbnail_url && (dbAsset as any).thumbnail_url.trim() !== "") {
            const originalUrl = (dbAsset as any).thumbnail_url;
            logger.debug(`[Thumbnail] ${videoTitle} - Found database thumbnail (${dbTime.toFixed(0)}ms):`, originalUrl);
            
            // Convert failing gateways to alternative gateways
            const convertedUrl = convertFailingGateway(originalUrl);
            
            if (originalUrl !== convertedUrl) {
              logger.debug(`[Thumbnail] ${videoTitle} - Converted gateway: ${originalUrl} -> ${convertedUrl}`);
            }
            
            // Cache the successful thumbnail URL
            thumbnailCacheRef.current.set(playbackId, convertedUrl);
            setThumbnailUrl(convertedUrl);
            setIsLoading(false);
            setRetryCount(0);
            const totalTime = performance.now() - startTime;
            logger.debug(`[Thumbnail] ${videoTitle} - Thumbnail loaded in ${totalTime.toFixed(0)}ms (source: database)`);
            return;
          } else {
            logger.debug(`[Thumbnail] ${videoTitle} - No database thumbnail found (${dbTime.toFixed(0)}ms)`);
          }
        } catch (dbError) {
          const dbTime = performance.now() - dbStartTime;
          // Log the error but don't throw - we'll fall back to Livepeer VTT
          logger.warn(`[Thumbnail] ${videoTitle} - Database fetch failed (${dbTime.toFixed(0)}ms), falling back to Livepeer VTT:`, dbError);
        }

        // If no database thumbnail or error, try Livepeer VTT thumbnails
        const vttStartTime = performance.now();
        logger.debug(`[Thumbnail] ${videoTitle} - Trying Livepeer VTT for playbackId: ${playbackId}`);
        const url = await getThumbnailUrl(playbackId);
        const vttTime = performance.now() - vttStartTime;
        
        // Convert failing gateways to alternative gateways
        const convertedUrl = url ? convertFailingGateway(url) : null;

        // Fallback to default thumbnail if no thumbnail found
        if (!convertedUrl) {
          logger.warn(`[Thumbnail] ${videoTitle} - No Livepeer VTT thumbnail found (${vttTime.toFixed(0)}ms), using default`);
          setThumbnailUrl("/Creative_TV.png");
        } else {
          if (url !== convertedUrl) {
            logger.debug(`[Thumbnail] ${videoTitle} - Converted VTT gateway: ${url} -> ${convertedUrl}`);
          }
          logger.debug(`[Thumbnail] ${videoTitle} - Using Livepeer VTT thumbnail (${vttTime.toFixed(0)}ms):`, convertedUrl);
          // Cache the successful thumbnail URL
          thumbnailCacheRef.current.set(playbackId, convertedUrl);
          setThumbnailUrl(convertedUrl);
          setRetryCount(0);
        }
      } catch (error) {
        const totalTime = performance.now() - startTime;
        logger.error(`[Thumbnail] ${videoTitle} - Error fetching thumbnail (${totalTime.toFixed(0)}ms):`, error);
        // Fallback to default thumbnail on error
        setThumbnailUrl("/Creative_TV.png");
      } finally {
        setIsLoading(false);
        const totalTime = performance.now() - startTime;
        if (totalTime > 1000) {
          logger.warn(`[Thumbnail] ${videoTitle} - Slow thumbnail fetch: ${totalTime.toFixed(0)}ms`);
        }
      }
    }

    fetchThumbnail();
  }, [playbackId, hasInitial, initialThumbnailUrl]);

  // Reset showPlayer when playbackId changes or component unmounts
  useEffect(() => {
    setShowPlayer(false);
    showPlayerRef.current = false;
    setIsPreviewing(false);

    return () => {
      setShowPlayer(false);
      showPlayerRef.current = false;
      setIsPreviewing(false);
    };
  }, [playbackId]);

  // Keep ref in sync with state
  useEffect(() => {
    showPlayerRef.current = showPlayer;
  }, [showPlayer]);

  // Preview Loop Logic (10s)
  useEffect(() => {
    if (isPreviewing && previewVideoRef.current) {
      const vid = previewVideoRef.current;
      let isMounted = true;

      const handleTimeUpdate = () => {
        if (!isMounted || !previewVideoRef.current) return;
        if (vid.currentTime >= 10) {
          vid.currentTime = 0;
          vid.play().catch(e => {
            // AbortError is expected when video is removed/unmounted
            if (e instanceof Error && e.name !== 'AbortError') {
              logger.error("Error looping preview:", e);
            }
          });
        }
      };

      vid.addEventListener('timeupdate', handleTimeUpdate);

      vid.muted = true;
      vid.play().catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        if (!isMounted || !previewVideoRef.current) return;
        if (err instanceof Error && err.name !== 'NotAllowedError') {
          logger.error("Autoplay muted preview failed", err);
        }
      });

      return () => {
        isMounted = false;
        if (previewVideoRef.current) {
          previewVideoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
          // Pause the video (pause() is synchronous and doesn't throw)
          try {
            previewVideoRef.current.pause();
          } catch (e) {
            // Ignore any errors - video may already be removed
            // This is unlikely since pause() is synchronous, but we handle it just in case
          }
        }
      };
    }
  }, [isPreviewing]);

  // Keep preview video muted state in sync with toggle
  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.muted = isMuted;
    }
  }, [isMuted, isPreviewing]);

  // Intersection Observer to reset states when out of view
  const setupObserver = React.useCallback((element: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            if (showPlayerRef.current) {
              setShowPlayer(false);
              showPlayerRef.current = false;
            }
            setIsPreviewing(false);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    observerRef.current = observer;
  }, []);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  const containerCallbackRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      setupObserver(element);
    },
    [setupObserver]
  );

  const handleThumbnailClick = (e: React.MouseEvent) => {
    onRequestPlayback?.();
    if (enablePreview) {
      // If preview is enabled, we don't want to expand the player inline.
      // The parent Link component will handle navigation.
      // We might want to stop propagation if there was logic here, but for now we just let it bubble.
      return;
    }
    setShowPlayer(true);
    onPlay?.();
  };

  const handleMouseEnter = () => {
    onRequestPlayback?.();
    if (enablePreview && !showPlayer) {
      setIsMuted(true);
      setIsPreviewing(true);
    }
  };

  const handleMouseLeave = () => {
    if (enablePreview && !showPlayer) {
      setIsPreviewing(false);
      setIsMuted(true);
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMuted((prev) => !prev);
  };

  // Find MP4 source for preview
  const mp4Source = src?.find(s => (s.type as string) === 'video/mp4' || (s.src as string).endsWith('.mp4'))?.src;

  // Show inline full player if clicked (and not in preview mode context usually, but kept for backward compat)
  if (showPlayer && src?.length) {
    return (
      <div ref={containerCallbackRef} className={className}>
        <Player
          src={src}
          assetId={assetId}
          title={title}
          onPlay={onPlay}
        />
      </div>
    );
  }

  // Show skeleton while fetching thumbnail URL
  if (isLoading) {
    return (
      <div className={`relative aspect-video ${className}`}>
        <Skeleton className="w-full h-full rounded-lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="h-16 w-16 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerCallbackRef}
      className={`relative aspect-video w-full group ${enablePreview ? '' : 'cursor-pointer'} ${className}`}
      onClick={handleThumbnailClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Preview Player */}
      {isPreviewing && enablePreview && mp4Source ? (
        <div className="absolute inset-0 z-10 rounded-lg overflow-hidden bg-black">
          <video
            ref={previewVideoRef}
            src={mp4Source}
            className="w-full h-full object-cover"
            playsInline
            muted={isMuted} // Controlled by state
            loop={false} // Managed manually for 10s loop
          />
          <button
            type="button"
            className="absolute bottom-2 right-2 z-20 rounded-full bg-black/50 p-1 transition-colors hover:bg-black/70"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Unmute preview' : 'Mute preview'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
          </button>
        </div>
      ) : null}

      {/* Fallback to Image */}
      {(!isPreviewing || !mp4Source) && (
        <>
          {/* Skeleton loader while image loads */}
          {imageLoading && (
            <div className="absolute inset-0">
              <Skeleton className="w-full h-full rounded-lg" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Skeleton className="h-16 w-16 rounded-full" />
              </div>
            </div>
          )}

          {thumbnailUrl ? (
            <GatewayImage
              src={thumbnailUrl}
              alt={title}
              fill
              className={`object-cover rounded-lg transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'
                }`}
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              fallbackSrc="/Creative_TV.png"
              showSkeleton={false}
              onLoad={() => {
                setImageLoading(false);
                setRetryCount(0); // Reset retry count on successful load
                // Cache successful thumbnail URL
                if (thumbnailUrl) {
                  thumbnailCacheRef.current.set(playbackId, thumbnailUrl);
                }
                logger.debug(`[Thumbnail] ${title || playbackId} - Image loaded successfully`);
              }}
              onError={(e) => {
                setImageLoading(false);
                logger.warn(`[Thumbnail] ${title || playbackId} - Image failed to load:`, thumbnailUrl);
                
                // If it's an IPFS URL, try alternative gateways
                if (isIpfsUrl(thumbnailUrl) && retryCount < 3) {
                  const gateways = getAllIpfsGateways(thumbnailUrl);
                  const currentIndex = gateways.findIndex(g => g === thumbnailUrl);
                  
                  if (currentIndex < gateways.length - 1) {
                    const nextGateway = gateways[currentIndex + 1];
                    logger.debug(`[Thumbnail] ${title || playbackId} - Retrying with alternative gateway: ${nextGateway}`);
                    setRetryCount(prev => prev + 1);
                    setThumbnailUrl(nextGateway);
                    setImageLoading(true);
                    return;
                  }
                }
                
                // If retries exhausted or not IPFS, fallback to default thumbnail
                if (thumbnailUrl !== "/Creative_TV.png") {
                  logger.debug(`[Thumbnail] ${title || playbackId} - All retries exhausted, falling back to default thumbnail`);
                  setThumbnailUrl("/Creative_TV.png");
                  setRetryCount(0);
                }
              }}
            />
          ) : (
            // Fallback to default thumbnail if no thumbnail URL
            <Image
              src="/Creative_TV.png"
              alt={title}
              fill
              className="object-cover rounded-lg"
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}

          {/* Play button overlay - only show when image is loaded and NOT previewing and not hidden */}
          {!imageLoading && thumbnailUrl && !isPreviewing && !enablePreview && !hidePlayOverlay && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all duration-200">
              <div className="flex items-center justify-center w-16 h-16 bg-white bg-opacity-90 rounded-full group-hover:bg-opacity-100 transition-all duration-200">
                <PlayIcon className="w-8 h-8 text-black ml-1" />
              </div>
            </div>
          )}
          {/* If preview enabled, maybe show a different indicator or nothing on hover since it plays */}
          {!imageLoading && thumbnailUrl && !isPreviewing && enablePreview && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 transition-all duration-200">
              {/* No play button for preview mode cards, or maybe a small one? User wants clicks to go to page. */}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VideoThumbnail;
