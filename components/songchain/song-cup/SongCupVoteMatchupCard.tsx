"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { songCupMuted } from "@/lib/songchain/song-cup/panel-styles";
import { SongCupOrbPostEmbed } from "./SongCupOrbPostEmbed";
import { useSongCupOrbPollVote } from "@/lib/hooks/song-cup/useSongCupOrbPollVote";
import type { SongCupMatchupWithVotes } from "@/lib/hooks/song-cup/useSongCupMatchups";
import type { SongCupVoteChoice } from "@/lib/sdk/supabase/song-cup-votes";
import {
  SongCupVoteCtaButton,
  SongCupVoteEntryName,
  SongCupVoteEntryTag,
  SongCupVoteMatchupSurface,
  SongCupVotePercent,
  SongCupVoteProgressLine,
  SongCupVoteRoundDate,
  SongCupVoteRoundTitle,
  SongCupVoteVs,
  SongCupMatchupStatusBadge,
} from "./vote/SongCupVoteUi";
import { getMatchupLifecycle } from "@/lib/songchain/song-cup/matchup-lifecycle";
import { toast } from "sonner";

type SongCupVoteMatchupCardProps = {
  matchup: SongCupMatchupWithVotes;
  walletConnected: boolean;
  onVote: (choice: SongCupVoteChoice) => Promise<boolean>;
  className?: string;
  displayMode?: "vote" | "schedule";
  nowMs?: number;
};

function splitLabel(label: string | null | undefined): { name: string; tag?: string } {
  if (!label) return { name: "Entry" };
  const parts = label.trim().split(/\s+/);
  if (parts.length <= 1) return { name: label };
  return { name: parts.slice(0, -1).join(" "), tag: parts[parts.length - 1] };
}

export function SongCupVoteMatchupCard({
  matchup,
  walletConnected,
  onVote,
  className,
  displayMode = "vote",
  nowMs = Date.now(),
}: SongCupVoteMatchupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [voting, setVoting] = useState<SongCupVoteChoice | null>(null);
  const { canWrite, promptWriteAccess } = useSongCupOrbPollVote();
  const isSchedule = displayMode === "schedule";
  const lifecycle = getMatchupLifecycle(matchup.starts_at, matchup.ends_at, matchup.status, nowMs);

  const leftParts = splitLabel(matchup.left_label);
  const rightParts = splitLabel(matchup.right_label);
  const needsOrbForVote = matchup.usesOrbPoll;

  const handleVote = async (choice: SongCupVoteChoice) => {
    if (needsOrbForVote && !canWrite) {
      promptWriteAccess();
      toast.error("Link your Orb account to vote on Lens");
      return;
    }
    if (!needsOrbForVote && !walletConnected) {
      toast.error("Connect your wallet to vote");
      return;
    }
    if (matchup.status !== "active") {
      toast.message("This matchup is not open for voting yet");
      return;
    }
    if (needsOrbForVote && !matchup.poll_post_id) {
      toast.error("Poll is still being set up — check back shortly");
      return;
    }
    setVoting(choice);
    const ok = await onVote(choice);
    setVoting(null);
    if (ok) toast.success(needsOrbForVote ? "Vote submitted on Lens" : "Vote recorded");
    else if (!needsOrbForVote) toast.error("Could not record vote");
  };

  return (
    <SongCupVoteMatchupSurface className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {matchup.subtitle && <SongCupVoteRoundDate>{matchup.subtitle}</SongCupVoteRoundDate>}
          <SongCupVoteRoundTitle className="mt-1">{matchup.title}</SongCupVoteRoundTitle>
        </div>
        {isSchedule && (
          <SongCupMatchupStatusBadge phase={lifecycle.phase} label={lifecycle.label} />
        )}
      </div>

      <div className="mt-5 flex w-full items-end justify-center gap-2 sm:gap-4">
        <div className="flex flex-1 flex-col items-end gap-2">
          <div className="flex w-full flex-col items-end gap-1">
            <SongCupVoteEntryName>{leftParts.name}</SongCupVoteEntryName>
            {leftParts.tag && <SongCupVoteEntryTag>{leftParts.tag}</SongCupVoteEntryTag>}
          </div>
          <SongCupOrbPostEmbed
            orbUrl={matchup.left_orb_url}
            postId={matchup.left_post_id}
            compact
            hideLabels
            selected={!isSchedule && matchup.userChoice === "left"}
            onSelect={!isSchedule && expanded ? () => void handleVote("left") : undefined}
          />
          {!isSchedule && (
            <>
              <SongCupVoteProgressLine pct={matchup.tally.leftPct} />
              <SongCupVotePercent value={matchup.tally.leftPct} />
            </>
          )}
        </div>

        <SongCupVoteVs className="mb-10 shrink-0 self-center" />

        <div className="flex flex-1 flex-col items-start gap-2">
          <div className="flex w-full flex-col items-start gap-1">
            <SongCupVoteEntryName className="text-left">{rightParts.name}</SongCupVoteEntryName>
            {rightParts.tag && (
              <SongCupVoteEntryTag className="text-left">{rightParts.tag}</SongCupVoteEntryTag>
            )}
          </div>
          <SongCupOrbPostEmbed
            orbUrl={matchup.right_orb_url}
            postId={matchup.right_post_id}
            compact
            hideLabels
            selected={!isSchedule && matchup.userChoice === "right"}
            onSelect={!isSchedule && expanded ? () => void handleVote("right") : undefined}
          />
          {!isSchedule && (
            <>
              <SongCupVoteProgressLine pct={matchup.tally.rightPct} className="self-start" />
              <SongCupVotePercent value={matchup.tally.rightPct} className="self-start text-left" />
            </>
          )}
        </div>
      </div>

      {!isSchedule && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <SongCupVoteCtaButton
            disabled={voting !== null}
            onClick={() => {
              if (expanded) return;
              setExpanded(true);
            }}
          >
            {voting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : expanded ? (
              "Tap a side to vote"
            ) : (
              "VOTE NOW "
            )}
          </SongCupVoteCtaButton>

          {matchup.userChoice && (
            <p className={cn("text-xs", songCupMuted)}>
              You voted for the {matchup.userChoice === "left" ? "left" : "right"} entry
            </p>
          )}
        </div>
      )}
    </SongCupVoteMatchupSurface>
  );
}
