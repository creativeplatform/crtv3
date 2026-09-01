"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, ExternalLink, Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HackBetaSubmissionThumbnail } from "@/components/chones/hack-beta/HackBetaSubmissionThumbnail";
import type { HackBetaSubmission } from "@/lib/sdk/supabase/hack-beta-submissions";
import { truncateWalletAddress } from "@/lib/chones/hack-beta/admin-config";
import { cn } from "@/lib/utils";

type HackBetaSubmissionReviewCardProps = {
  submission: HackBetaSubmission;
  onApprove: (id: string) => void;
  onFavorite: (id: string, favorite: boolean) => void;
  onReject: (id: string) => void;
  className?: string;
};

export function HackBetaSubmissionReviewCard({
  submission,
  onApprove,
  onFavorite,
  onReject,
  className,
}: HackBetaSubmissionReviewCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/50",
        className,
      )}
    >
      <HackBetaSubmissionThumbnail
        playbackId={submission.playback_id}
        thumbnailUrl={submission.thumbnail_url}
        title={submission.title}
        assetId={submission.video_asset_id}
      />

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h4 className="line-clamp-1 text-sm font-semibold">
          {submission.title || "Untitled submission"}
        </h4>
        <p className="text-[11px] text-muted-foreground">
          {truncateWalletAddress(submission.wallet_address)} ·{" "}
          {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
        </p>
        {submission.description && (
          <p className="line-clamp-3 text-xs text-muted-foreground">{submission.description}</p>
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
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              Favorite
            </Badge>
          )}
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[10px]" asChild>
            <Link href={`/discover/${submission.video_asset_id}`} target="_blank">
              <ExternalLink className="h-3 w-3" />
              Video
            </Link>
          </Button>
          {submission.grove_url && (
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[10px]" asChild>
              <Link href={submission.grove_url} target="_blank" rel="noopener noreferrer">
                Grove
              </Link>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 gap-1 text-[11px]"
            onClick={() => onApprove(submission.id)}
            disabled={submission.status === "approved" && !submission.is_favorite}
          >
            <CheckCircle className="h-3 w-3" />
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 gap-1 border-amber-500/40 text-[11px]"
            onClick={() => onFavorite(submission.id, !submission.is_favorite)}
          >
            <Star className="h-3 w-3" />
            {submission.is_favorite ? "Unfavorite" : "Favorite"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 gap-1 border-red-500/40 text-[11px] text-red-600"
            onClick={() => onReject(submission.id)}
            disabled={submission.status === "rejected"}
          >
            <XCircle className="h-3 w-3" />
            Reject
          </Button>
        </div>
      </div>
    </article>
  );
}

export type HackBetaSubmissionStatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "favorite";

export const HACK_BETA_STATUS_FILTERS: {
  id: HackBetaSubmissionStatusFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "favorite", label: "Favorites" },
  { id: "rejected", label: "Rejected" },
];

export function filterHackBetaSubmissions(
  submissions: HackBetaSubmission[],
  filter: HackBetaSubmissionStatusFilter,
): HackBetaSubmission[] {
  if (filter === "all") return submissions;
  if (filter === "favorite") return submissions.filter((s) => s.is_favorite);
  return submissions.filter((s) => s.status === filter);
}
