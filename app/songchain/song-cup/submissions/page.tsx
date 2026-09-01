"use client";

import { useMemo, useState } from "react";
import { useSongCupSubmissions } from "@/lib/hooks/song-cup/useSongCupSubmissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  SongCupSubmissionReviewCard,
  SUBMISSION_STATUS_FILTERS,
  filterSubmissionsByStatus,
  type SongCupSubmissionStatusFilter,
} from "@/components/songchain/song-cup/SongCupSubmissionReviewCard";
import {
  SONG_CUP_ADMIN_WALLETS,
  truncateWalletAddress,
} from "@/lib/songchain/song-cup/admin-config";

export default function SongCupSubmissionsPage() {
  const [statusFilter, setStatusFilter] = useState<SongCupSubmissionStatusFilter>("pending");

  const {
    submissions,
    isLoading,
    error,
    refetch,
    updateStatus,
    setFavorite,
    isAdmin,
    walletAddress,
    isAdminLoading,
  } = useSongCupSubmissions(true);

  const filtered = useMemo(
    () => filterSubmissionsByStatus(submissions, statusFilter),
    [submissions, statusFilter],
  );

  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === "pending").length,
    [submissions],
  );

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Song Cup Submissions</h1>
            <p className="text-sm text-muted-foreground">
              Review entries from Creative TV. Vote favorites to rank submissions.
            </p>
            {isAdmin && (
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingCount} pending · {submissions.length} total
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isAdminLoading && (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Resolving smart wallet…
            </CardContent>
          </Card>
        )}

        {!isAdminLoading && !isAdmin && (
          <Card className="border-yellow-500/30 bg-yellow-950/20">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
              <div className="space-y-1">
                <p className="font-medium">Admin access only</p>
                <p className="text-sm text-muted-foreground">
                  Connect an admin wallet (
                  {SONG_CUP_ADMIN_WALLETS.map(truncateWalletAddress).join(" or ")}) to review
                  submissions.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {SUBMISSION_STATUS_FILTERS.map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                variant={statusFilter === id ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}

        {isAdmin && error && (
          <Card className="border-red-500/30 bg-red-950/20">
            <CardContent className="py-4 text-sm text-red-400">{error}</CardContent>
          </Card>
        )}

        {isAdmin && isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-lg" />
            ))}
          </div>
        )}

        {isAdmin && !isLoading && filtered.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No {statusFilter === "all" ? "" : statusFilter} submissions yet.
            </CardContent>
          </Card>
        )}

        {isAdmin && !isLoading && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {isAdmin && walletAddress && (
          <p className="text-center text-xs text-muted-foreground">
            Signed in as {truncateWalletAddress(walletAddress)}
          </p>
        )}
      </div>
    </div>
  );
}
