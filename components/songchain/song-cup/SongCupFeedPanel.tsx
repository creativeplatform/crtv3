"use client";

import { useRef } from "react";
import { useSongchainGroupMembership } from "@/hooks/useSongchainGroupMembership";
import {
  SongchainFeedSection,
  type SongchainFeedHandle,
} from "@/components/songchain/SongchainFeedSection";
import { SongCupFeedCompose } from "./SongCupFeedCompose";
import { SongCupFeedMembersRow } from "./SongCupFeedMembersRow";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { SONG_CUP_PLAY_LINKS } from "@/lib/songchain/events";
import {
  songCupAccent,
  songCupLabel,
  songCupMuted,
  songCupPanel,
} from "@/lib/songchain/song-cup/panel-styles";

type SongCupFeedPanelProps = {
  feedId: string | null;
  groupId: string | null;
  graphId: string | null;
  feedTitle?: string;
  feedDescription?: string;
  orbClubUrl?: string;
  placeholder?: string;
  clubLogoUrl?: string;
  clubLabel?: string;
};

export function SongCupFeedPanel({
  feedId,
  groupId,
  graphId,
  feedTitle = "Song Cup club feed",
  feedDescription = "Read the member feed. Join the club on Orb to post and react.",
  orbClubUrl,
  placeholder,
  clubLogoUrl,
  clubLabel,
}: SongCupFeedPanelProps) {
  const feedRef = useRef<SongchainFeedHandle>(null);
  const membership = useSongchainGroupMembership({ groupId });

  const joinHref = orbClubUrl ?? SONG_CUP_PLAY_LINKS.club;

  return (
    <div className={cn(songCupPanel, "p-4 sm:p-5")}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <aside className="flex shrink-0 flex-col items-start gap-3 sm:w-[147px]">
          <img
            src="/songchain/button-icons/feed-icon.svg"
            alt="The Feed"
            className="h-[120px] w-[120px] object-contain"
          />
          <div className="w-full space-y-2">
            <p className={songCupLabel}>For Orb members only</p>
            {membership.isMember ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 w-full text-[10px] font-semibold uppercase tracking-wide",
                  songCupAccent,
                )}
                disabled={membership.leaving}
                onClick={() => void membership.leave()}
              >
                {membership.leaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Leave club"
                )}
              </Button>
            ) : membership.isPendingApproval ? (
              <p className={cn("text-[10px] font-semibold uppercase tracking-wide", songCupAccent)}>
                Pending approval
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 w-full text-[10px] font-semibold uppercase tracking-wide hover:border-fuchsia-500",
                  songCupAccent,
                )}
                disabled={membership.joining || !membership.groupId}
                onClick={() => void membership.join()}
              >
                {membership.joining ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Join club"
                )}
              </Button>
            )}
            {!membership.isMember && !membership.isPendingApproval && (
              <a
                href={joinHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("block text-[10px] underline", songCupMuted)}
              >
                Or open on Orb
              </a>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {membership.loading && (
            <div className={cn("flex h-24 items-center justify-center gap-2 text-sm", songCupMuted)}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking club membership…
            </div>
          )}

          {!membership.loading && (
            <>
              {membership.isMember && (
                <SongCupFeedCompose
                  feedId={feedId}
                  placeholder={placeholder}
                  onPosted={(created) => feedRef.current?.registerNewPost(created)}
                />
              )}

              <SongCupFeedMembersRow
                groupId={groupId}
                orbClubUrl={joinHref}
                clubLogoUrl={clubLogoUrl}
                clubLabel={clubLabel}
              />

              <SongchainFeedSection
                ref={feedRef}
                title={feedTitle}
                description={feedDescription}
                feedId={feedId}
                graphId={graphId}
                onPostUpdated={() => feedRef.current?.reload()}
                emptyDescription="Lens custom feeds only show posts published to that feed contract. Existing Orb profile or global posts are not backfilled."
                layout="grid"
                hideHeader
                readOnly={!membership.isMember}
                cardVariant="song-cup"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
