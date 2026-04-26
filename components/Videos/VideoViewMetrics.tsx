"use client";
import React, { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface VideoViewMetricsProps {
  playbackId: string;
}

const VideoViewMetrics: React.FC<VideoViewMetricsProps> = ({ playbackId }) => {
  const [viewMetrics, setViewMetrics] = useState<{
    playbackId: string;
    viewCount: number;
    playtimeMins: number;
    legacyViewCount: number;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchViewMetrics() {
      if (!playbackId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/livepeer/views/${playbackId}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch view metrics");
        }

        const data = await response.json();
        
        if (data.success) {
          setViewMetrics({
            playbackId: data.playbackId,
            viewCount: data.viewCount,
            playtimeMins: data.playtimeMins,
            legacyViewCount: data.legacyViewCount,
          });
        } else {
          setError("Failed to fetch view metrics");
        }
      } catch (err) {
        setError((err as Error).message || "Failed to fetch view metrics");
      } finally {
        setLoading(false);
      }
    }

    fetchViewMetrics();
  }, [playbackId]);

  if (loading) return <Skeleton className="w-16 h-4" />;
  if (error) return <p>Error: {error}</p>;

  const totalViews =
    (viewMetrics?.viewCount ?? 0) + (viewMetrics?.legacyViewCount ?? 0);

  return (
    <>
      <h3 className="font-medium text-sm md:text-base text-gray-500">{`Views: ${totalViews}`}</h3>
    </>
  );
};

export default VideoViewMetrics;
