"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import VideoCard from "@/components/Videos/VideoCard";
import { Src } from "@livepeer/react";
import { VideoCardSkeleton } from "./VideoCardSkeleton";
import { Pagination } from "@/components/ui/pagination";
import { fetchPublishedVideos } from "@/lib/utils/published-videos-client";
import type { VideoAsset } from "@/lib/types/video-asset";
import { logger } from "@/lib/utils/logger";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const ITEMS_PER_PAGE = 12;

/** Card shape for Discover grid — posters first; playback filled lazily per card. */
export type DiscoverVideoCard = Omit<
  VideoAsset,
  "id" | "status" | "created_at"
> & {
  detailedSrc: Src[] | null;
  id: string;
  playbackId: string;
  name: string;
  status: { phase: "ready" };
  creatorId: { value: string };
  createdAt: Date;
  created_at: Date;
  thumbnail_url: string | null;
  /** Numeric DB id for contributions / buy button */
  videoAssetDbId?: number;
  dbStatus?: VideoAsset["status"];
  sourceType?: VideoAsset["source_type"];
};

interface VideoCardGridProps {
  searchQuery?: string;
  category?: string;
  creatorId?: string;
  orderBy?: "created_at" | "views_count" | "likes_count" | "updated_at";
}

function mapPublishedToCard(video: VideoAsset): DiscoverVideoCard {
  return {
    ...video,
    id: video.asset_id,
    playbackId: video.playback_id,
    name: video.title,
    status: {
      phase: "ready" as const,
    },
    creatorId: {
      value: video.creator_id,
    },
    createdAt: video.created_at,
    created_at: video.created_at,
    thumbnail_url:
      (video as { thumbnail_url?: string }).thumbnail_url ||
      video.thumbnailUri ||
      null,
    detailedSrc: null,
    videoAssetDbId: video.id,
    dbStatus: video.status,
    sourceType: video.source_type,
  };
}

const VideoCardGrid: React.FC<VideoCardGridProps> = ({
  searchQuery,
  category,
  creatorId,
  orderBy = "created_at",
}) => {
  const [playbackSources, setPlaybackSources] = useState<
    DiscoverVideoCard[] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalAssets, setTotalAssets] = useState<number>(0);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [validVideosCount, setValidVideosCount] = useState<number>(0);

  // Match grid breakpoints: 1 col default, 2 from md, 3–4 from xl
  const isXl = useMediaQuery("(min-width: 1280px)");
  const isMd = useMediaQuery("(min-width: 768px)");
  const priorityCount = useMemo(() => {
    if (isXl) return 4;
    if (isMd) return 2;
    return 1; // mobile-first (also while matchMedia is undefined on SSR)
  }, [isXl, isMd]);

  const fetchSources = useCallback(
    async (page: number) => {
      try {
        setLoading(true);
        setError(null);

        const offset = (page - 1) * ITEMS_PER_PAGE;

        const { data: videos, total, hasMore } = await fetchPublishedVideos({
          limit: ITEMS_PER_PAGE,
          offset,
          orderBy,
          order: "desc",
          creatorId,
          category,
          search: searchQuery,
        });

        setTotalAssets(total);

        if (videos.length === 0 && page === 1) {
          setError(
            searchQuery
              ? "No videos found matching your search."
              : "No videos available at the moment.",
          );
          setPlaybackSources([]);
          setValidVideosCount(0);
          return;
        }

        // Paint posters immediately — playback-info is fetched per card near viewport
        const cards = videos.map(mapPublishedToCard);
        setValidVideosCount(cards.length);
        setHasNextPage(hasMore);
        setPlaybackSources(cards);
      } catch (err) {
        logger.error("Error fetching videos:", err);
        setError("Failed to load videos. Please try again later.");
        setValidVideosCount(0);
        setPlaybackSources([]);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, category, creatorId, orderBy],
  );

  useEffect(() => {
    setCurrentPage(1);
    setValidVideosCount(0);
  }, [searchQuery, category, creatorId, orderBy]);

  useEffect(() => {
    fetchSources(currentPage);
  }, [currentPage, fetchSources]);

  const handleNextPage = useCallback(() => {
    if (!hasNextPage || loading) return;
    setCurrentPage((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [hasNextPage, loading]);

  const handlePrevPage = useCallback(() => {
    if (currentPage === 1 || loading) return;
    setCurrentPage((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage, loading]);

  const shouldShowPagination = useCallback(() => {
    return totalAssets > ITEMS_PER_PAGE || currentPage > 1 || hasNextPage;
  }, [totalAssets, currentPage, hasNextPage]);

  if (loading) {
    return (
      <div>
        <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-1 sm:gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <VideoCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="flex min-h-[200px] items-center justify-center rounded-lg bg-red-50 p-4 text-red-800">
          <p>{error}</p>
        </div>

        {shouldShowPagination() && (
          <Pagination
            hasNextPage={hasNextPage}
            hasPrevPage={currentPage > 1}
            currentPage={currentPage}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            isLoading={loading}
            totalDisplayed={validVideosCount}
            totalVideos={totalAssets}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </div>
    );
  }

  if (!playbackSources || playbackSources.length === 0) {
    return (
      <div>
        <div className="flex min-h-[200px] items-center justify-center rounded-lg bg-gray-50 p-4">
          <p>No videos available at the moment. Please check back later.</p>
        </div>

        {shouldShowPagination() && (
          <Pagination
            hasNextPage={hasNextPage}
            hasPrevPage={currentPage > 1}
            currentPage={currentPage}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            isLoading={loading}
            totalDisplayed={validVideosCount}
            totalVideos={totalAssets}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-1 sm:gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {playbackSources.map((video, index) => (
          <VideoCard
            key={video.id}
            asset={video as any}
            playbackSources={video.detailedSrc}
            priority={index < priorityCount}
          />
        ))}
      </div>

      {shouldShowPagination() && (
        <Pagination
          hasNextPage={hasNextPage}
          hasPrevPage={currentPage > 1}
          currentPage={currentPage}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
          isLoading={loading}
          totalDisplayed={validVideosCount}
          totalVideos={totalAssets}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}
    </div>
  );
};

export default VideoCardGrid;
