"use client";

import type { VideoAsset } from "@/lib/types/video-asset";

export interface FetchPublishedVideosOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'views_count' | 'likes_count' | 'updated_at';
  order?: 'asc' | 'desc';
  creatorId?: string;
  category?: string;
  search?: string;
}

export interface PublishedVideosResponse {
  data: VideoAsset[];
  total: number;
  hasMore: boolean;
}

/**
 * Client-side utility to fetch published videos from the API
 * Uses an uncached request so view-count ordering reflects the latest synced data.
 */
export async function fetchPublishedVideos(
  options: FetchPublishedVideosOptions = {}
): Promise<PublishedVideosResponse> {
  const params = new URLSearchParams();
  
  if (options.limit) params.set("limit", options.limit.toString());
  if (options.offset) params.set("offset", options.offset.toString());
  if (options.orderBy) params.set("orderBy", options.orderBy);
  if (options.order) params.set("order", options.order);
  if (options.creatorId) params.set("creatorId", options.creatorId);
  if (options.category) params.set("category", options.category);
  if (options.search) params.set("search", options.search);

  const response = await fetch(`/api/video-assets/published?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to fetch published videos: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Hook-friendly version that can be used with React Query or SWR
 */
export const publishedVideosQueryKey = (options: FetchPublishedVideosOptions = {}) => {
  return ['published-videos', options] as const;
};

