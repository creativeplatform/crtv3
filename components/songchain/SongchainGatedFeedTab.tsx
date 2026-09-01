"use client";

import { useSongchainGroupMembership } from "@/hooks/useSongchainGroupMembership";
import { SongchainComposePost } from "@/components/songchain/SongchainComposePost";
import { SongchainFeedSection } from "@/components/songchain/SongchainFeedSection";
import { Loader2, Lock, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SongchainGatedFeedTabProps = {
  gateGroupId: string | null;
  feedId: string | null;
  graphId: string | null;
  feedTitle: string;
  feedDescription: string;
  clubGateTitle?: string;
  clubGateDescription?: string;
  orbClubUrl?: string;
  /** If true, non-members can read the feed but cannot post/interact. */
  allowReadBeforeJoin?: boolean;
  /** Enables a contained, scroll-driven animated feed. */
  animated?: boolean;
};

export function SongchainGatedFeedTab({
  gateGroupId,
  feedId,
  graphId,
  feedTitle,
  feedDescription,
  clubGateTitle,
  clubGateDescription,
  orbClubUrl,
  allowReadBeforeJoin = false,
  animated = false,
}: SongchainGatedFeedTabProps) {
  const membership = useSongchainGroupMembership({ groupId: gateGroupId });

  if (membership.loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking club membership…
      </div>
    );
  }

  const isMember = membership.isMember ?? false;

  return (
    <div className={cn("space-y-6")}>
      {/* Club membership banner — always visible, toggles Join/Leave */}
      <div className="flex flex-col gap-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10">
            {isMember ? (
              <Users className="h-5 w-5 text-fuchsia-400" />
            ) : (
              <Lock className="h-5 w-5 text-fuchsia-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-foreground">
              {isMember
                ? `Joined ${membership.name ?? "the club"}`
                : membership.name
                  ? `Join ${membership.name}`
                  : clubGateTitle ?? "Join the club to post"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isMember
                ? "You are a member of this club. You can post, comment, and react in the feed."
                : clubGateDescription ??
                  "Join the club on Lens to post, comment, and react."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMember ? (
            <Button
              variant="secondary"
              className="shrink-0"
              disabled={membership.leaving || !membership.groupId}
              onClick={() => void membership.leave()}
            >
              {membership.leaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Leave club
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="shrink-0"
              disabled={membership.joining || !membership.groupId}
              onClick={() => void membership.join()}
            >
              {membership.joining ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Join club
            </Button>
          )}
          {orbClubUrl ? (
            <Button asChild variant="outline" className="shrink-0">
              <a href={orbClubUrl} target="_blank" rel="noopener noreferrer">
                Open on Orb <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {isMember && <SongchainComposePost feedId={feedId} />}

      {(isMember || allowReadBeforeJoin) && (
        <SongchainFeedSection
          title={feedTitle}
          description={feedDescription}
          feedId={feedId}
          graphId={graphId}
          emptyDescription="Lens custom feeds only show posts published to that feed contract. Existing Orb profile or global posts are not backfilled."
          readOnly={allowReadBeforeJoin && !isMember}
          animated={animated}
        />
      )}
    </div>
  );
}
