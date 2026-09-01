"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, ExternalLink, Film, Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SongCupSubmission } from "@/lib/sdk/supabase/song-cup-submissions";
import { resolveOrbMediaUrl } from "@/lib/sdk/orb/media";
import { truncateWalletAddress } from "@/lib/songchain/song-cup/admin-config";
import {
  songCupAccentYellow,
  songCupBody,
  songCupMuted,
  songCupPostCard,
} from "@/lib/songchain/song-cup/panel-styles";
import { cn } from "@/lib/utils/utils";

type SongCupSubmissionReviewCardProps = {
  submission: SongCupSubmission;
  onFavorite: (id: string, favorite: boolean) => void;
  onReject: (id: string) => void;
  className?: string;
};

function resolveMediaUrl(url: string, type: "video" | "image"): string {
  return (
    resolveOrbMediaUrl(url, { type }) ??
    (url.startsWith("ipfs://")
      ? url.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/")
      : url)
  );
}

function SubmissionVideo({ url }: { url: string }) {
  return (
    <video
      src={resolveMediaUrl(url, "video")}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-lg bg-black object-contain"
    />
  );
}

export function SongCupSubmissionReviewCard({
  submission,
  onFavorite,
  onReject,
  className,
}: SongCupSubmissionReviewCardProps) {
  const coverUrl = submission.cover_url
    ? resolveMediaUrl(submission.cover_url, "image")
    : null;

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-xl", songCupPostCard, className)}>
      {coverUrl ? (
        <div className="relative aspect-video w-full overflow-hidden bg-black/40">
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}

      {submission.grove_url ? (
        <div className={cn(coverUrl ? "p-2 pt-0" : "")}>
          <SubmissionVideo url={submission.grove_url} />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-muted/50 dark:bg-white/5">
          <Film className={cn("h-8 w-8", songCupMuted)} />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h4 className={cn("line-clamp-1 text-sm font-semibold", songCupBody)}>
          {submission.title || "Untitled submission"}
        </h4>

        {submission.artist_handle && (
          <p className={cn("text-xs font-medium", songCupAccentYellow)}>{submission.artist_handle}</p>
        )}

        {submission.email && (
          <p className={cn("truncate text-[11px]", songCupMuted)}>{submission.email}</p>
        )}

        <p className={cn("text-[11px]", songCupMuted)}>
          {truncateWalletAddress(submission.wallet_address)} ·{" "}
          {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
        </p>

        {submission.description && (
          <p className={cn("line-clamp-3 text-xs", songCupMuted)}>{submission.description}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Badge
            variant={
              submission.status === "approved"
                ? "default"
                : submission.status === "rejected"
                  ? "destructive"
                  : "secondary"
            }
            className="text-[10px]"
          >
            {submission.status}
          </Badge>
          {submission.is_favorite && (
            <Badge variant="outline" className="gap-1 border-[#feed01]/50 text-[10px] text-[#feed01]">
              <Star className="h-3 w-3 fill-[#feed01]" />
              Favorite
            </Badge>
          )}
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[10px]" asChild>
            <Link href={submission.grove_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Grove
            </Link>
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 flex-1 gap-1 text-[11px]",
              submission.is_favorite
                ? "border-[#feed01]/60 bg-[#feed01]/10 text-[#feed01]"
                : "border-emerald-500/40 text-emerald-300",
            )}
            onClick={() => onFavorite(submission.id, !submission.is_favorite)}
          >
            <Star className={cn("h-3 w-3", submission.is_favorite && "fill-[#feed01]")} />
            {submission.is_favorite ? "Unfavorite" : "Favorite"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 gap-1 text-[11px] border-red-500/40 text-red-300"
            onClick={() => onReject(submission.id)}
            disabled={submission.status === "rejected"}
          >
            <XCircle className="h-3 w-3" />
            Reject
          </Button>
        </div>

        {submission.is_favorite && (
          <p className={cn("flex items-center gap-1 text-[10px]", songCupMuted)}>
            <CheckCircle className="h-3 w-3 text-[#feed01]" />
            Marked as judge favorite
          </p>
        )}
      </div>
    </article>
  );
}

export type SongCupSubmissionStatusFilter = "all" | "pending" | "favorites" | "rejected";

export const SUBMISSION_STATUS_FILTERS: { id: SongCupSubmissionStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "favorites", label: "Favorites" },
  { id: "rejected", label: "Rejected" },
];

export function filterSubmissionsByStatus(
  submissions: SongCupSubmission[],
  filter: SongCupSubmissionStatusFilter,
): SongCupSubmission[] {
  if (filter === "all") return submissions;
  if (filter === "favorites") return submissions.filter((s) => s.is_favorite);
  return submissions.filter((s) => s.status === filter);
}
