"use client";

import type React from "react";
import { EyeIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLivepeerViewMetrics } from "@/lib/hooks/livepeer/useLivepeerViewMetrics";

interface ViewsComponentProps {
  playbackId: string;
  /** DB-synced views_count used when Livepeer temporarily returns 0 or errors. */
  fallbackViews?: number;
}

export const ViewsComponent: React.FC<ViewsComponentProps> = ({
  playbackId,
  fallbackViews = 0,
}) => {
  const { totalViews, loading } = useLivepeerViewMetrics(playbackId);

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <EyeIcon className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>
    );
  }

  const fallback = Math.max(0, Number(fallbackViews) || 0);
  const livepeer = Math.max(0, Number(totalViews) || 0);
  const displayViews = Math.max(livepeer, fallback);

  // Never show "0 views", even when Livepeer returns a zeroed metrics object.
  if (displayViews <= 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <EyeIcon className="h-4 w-4" />
      <span>{displayViews.toLocaleString()} views</span>
    </div>
  );
};
