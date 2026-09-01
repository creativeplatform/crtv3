"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSongCupSubmissions } from "@/lib/hooks/song-cup/useSongCupSubmissions";
import {
  SongCupSubmissionReviewCard,
  SUBMISSION_STATUS_FILTERS,
  filterSubmissionsByStatus,
  type SongCupSubmissionStatusFilter,
} from "@/components/songchain/song-cup/SongCupSubmissionReviewCard";
import {
  songCupAccentYellow,
  songCupAdminSection,
  songCupMuted,
} from "@/lib/songchain/song-cup/panel-styles";
import { cn } from "@/lib/utils/utils";

type SongCupAdminSubmissionsListProps = {
  className?: string;
  compact?: boolean;
};

export function SongCupAdminSubmissionsList({
  className,
  compact = false,
}: SongCupAdminSubmissionsListProps) {
  const [statusFilter, setStatusFilter] = useState<SongCupSubmissionStatusFilter>("pending");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const { submissions, isLoading, error, refetch, updateStatus, setFavorite, isAdmin } =
    useSongCupSubmissions(true);

  useEffect(() => {
    if (!isLoading && !error) {
      setLastRefreshed(new Date());
    }
  }, [isLoading, error]);

  const filtered = useMemo(
    () => filterSubmissionsByStatus(submissions, statusFilter),
    [submissions, statusFilter],
  );

  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === "pending").length,
    [submissions],
  );

  if (!isAdmin) return null;

  return (
    <section className={cn(songCupAdminSection, className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className={cn("text-lg font-bold uppercase tracking-wide", songCupAccentYellow)}>
            Submissions review
          </h3>
          <p className={cn("text-xs", songCupMuted)}>
            {pendingCount} pending · {submissions.length} total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
          {!compact && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/songchain/song-cup/submissions">Full page</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SUBMISSION_STATUS_FILTERS.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            variant={statusFilter === id ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setStatusFilter(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-lg bg-white/10" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className={cn("py-8 text-center text-sm", songCupMuted)}>
          No {statusFilter === "all" ? "" : statusFilter} submissions yet.
        </p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((submission) => (
            <SongCupSubmissionReviewCard
              key={submission.id}
              submission={submission}
              onFavorite={(id, favorite) => void setFavorite(id, favorite)}
              onReject={(id) => void updateStatus(id, "rejected")}
            />
          ))}
        </div>
      )}

      {!isLoading && filtered.length > 0 && lastRefreshed && (
        <p className={cn("mt-3 text-[11px]", songCupMuted)}>
          Last refreshed {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
        </p>
      )}
    </section>
  );
}
