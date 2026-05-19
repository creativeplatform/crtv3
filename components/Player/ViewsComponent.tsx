"use client";

import type React from "react";
import { EyeIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLivepeerViewMetrics } from "@/lib/hooks/livepeer/useLivepeerViewMetrics";


interface ViewsComponentProps {
  playbackId: string;
}

export const ViewsComponent: React.FC<ViewsComponentProps> = ({
  playbackId,
}) => {
  const { totalViews, viewMetrics, loading, error } =
    useLivepeerViewMetrics(playbackId);

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-sm text-gray-400">
        <EyeIcon className="h-4 w-4" />
        <Skeleton className="h-4 w-16 bg-slate-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400"
        title={error}
      >
        <EyeIcon className="h-4 w-4" />
        <span>Error</span>
      </div>
    );
  }

  if (!viewMetrics) {
    return (
      <div className="flex items-center gap-1 text-sm text-gray-400">
        <EyeIcon className="h-4 w-4" />
        <span>0 views</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm text-gray-200">
      <EyeIcon className="h-4 w-4" />
      <span>{totalViews.toLocaleString()} views</span>
    </div>
  );
};
