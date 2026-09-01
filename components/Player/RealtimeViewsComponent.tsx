"use client";

import type React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLivepeerRealtimeMetrics } from "@/lib/hooks/livepeer/useLivepeerRealtimeMetrics";

interface RealtimeViewsComponentProps {
  playbackId: string;
}

export const RealtimeViewsComponent: React.FC<RealtimeViewsComponentProps> = ({
  playbackId,
}) => {
  const { viewerCount, loading, error } =
    useLivepeerRealtimeMetrics(playbackId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-800/80 px-3 py-1.5 backdrop-blur">
        <div className="h-2 w-2 animate-pulse rounded-full bg-gray-500" />
        <Skeleton className="h-4 w-12 bg-slate-700" />
      </div>
    );
  }

  if (error) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-400 shadow-sm backdrop-blur">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <span className="font-mono font-semibold text-white/90">
        {(viewerCount ?? 0).toLocaleString()} watching
      </span>
    </div>
  );
};
