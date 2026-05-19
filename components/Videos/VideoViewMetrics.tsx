"use client";
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLivepeerViewMetrics } from "@/lib/hooks/livepeer/useLivepeerViewMetrics";

interface VideoViewMetricsProps {
  playbackId: string;
}

const VideoViewMetrics: React.FC<VideoViewMetricsProps> = ({ playbackId }) => {
  const { totalViews, loading, error } = useLivepeerViewMetrics(playbackId);

  if (loading) return <Skeleton className="w-16 h-4" />;
  if (error) return <p>Error: {error}</p>;

  return (
    <>
      <h3 className="font-medium text-sm md:text-base text-gray-500">{`Views: ${totalViews}`}</h3>
    </>
  );
};

export default VideoViewMetrics;
