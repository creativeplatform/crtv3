"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSongCupAdmin } from "@/lib/hooks/song-cup/useSongCupAdmin";
import {
  useSongCupMatchups,
  type SongCupMatchupFilter,
} from "@/lib/hooks/song-cup/useSongCupMatchups";
import { SongCupVoteMatchupCard } from "./SongCupVoteMatchupCard";
import { SongCupAdminMatchupForm } from "./SongCupAdminMatchupForm";
import {
  SongCupClubQrCard,
  SongCupVoteContentWell,
  SongCupVoteFilterPill,
  SongCupVoteGradientGlow,
  SongCupVoteLogoBanner,
  SongCupVoteTitle,
} from "./vote/SongCupVoteUi";
import { cn } from "@/lib/utils/utils";
import { songCupMuted } from "@/lib/songchain/song-cup/panel-styles";
import { SONG_CUP_PLAY_LINKS } from "@/lib/songchain/events";
import { getMatchupLifecycle } from "@/lib/songchain/song-cup/matchup-lifecycle";

const FILTERS: { id: SongCupMatchupFilter; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
];

type SongCupSchedulePanelProps = {
  className?: string;
  orbClubUrl?: string;
};

export function SongCupSchedulePanel({ className, orbClubUrl }: SongCupSchedulePanelProps) {
  const clubUrl = orbClubUrl ?? SONG_CUP_PLAY_LINKS.club;
  const { isAdmin } = useSongCupAdmin();
  const [filter, setFilter] = useState<SongCupMatchupFilter>("all");
  const [now, setNow] = useState(() => Date.now());

  const {
    matchups,
    isLoading,
    error,
    createMatchup,
    updateMatchupStatus,
    removeMatchup,
  } = useSongCupMatchups(null, "all");

  const createScheduleMatchup = useCallback(
    (data: Parameters<typeof createMatchup>[0]) =>
      createMatchup(data, { skipPoll: true }),
    [createMatchup],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const scheduleMatchups = useMemo(() => {
    const rows = matchups.filter((m) => {
      const phase = getMatchupLifecycle(m.starts_at, m.ends_at, m.status, now).phase;
      if (filter === "upcoming") {
        return (
          phase === "countdown" ||
          phase === "live" ||
          m.status === "upcoming" ||
          m.status === "active"
        );
      }
      if (filter === "past") {
        return phase === "ended" || m.status === "past";
      }
      return true;
    });

    return [...rows].sort((a, b) => {
      const aStart = a.starts_at ? Date.parse(a.starts_at) : 0;
      const bStart = b.starts_at ? Date.parse(b.starts_at) : 0;
      return bStart - aStart;
    });
  }, [matchups, filter, now]);

  return (
    <SongCupVoteContentWell className={className}>
      <SongCupVoteGradientGlow className="left-1/2 top-0 h-[275px] w-[353px] -translate-x-1/2 sm:h-[413px] sm:w-[529px]" />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="relative flex flex-col items-center gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-1 flex-col items-center gap-4 text-center">
            <SongCupVoteLogoBanner />
            <SongCupVoteTitle title="SCHEDULE" />
          </div>
          <SongCupClubQrCard url={clubUrl} className="hidden shrink-0 xl:flex" />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-wrap justify-center gap-2">
          {FILTERS.map(({ id, label }) => (
            <SongCupVoteFilterPill
              key={id}
              label={label}
              active={filter === id}
              onClick={() => setFilter(id)}
            />
          ))}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {isLoading && (
          <div className={cn("flex h-40 items-center justify-center gap-2", songCupMuted)}>
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading schedule…
          </div>
        )}

        {!isLoading && scheduleMatchups.length === 0 && (
          <div className="rounded-[20px] bg-muted/50 px-6 py-12 text-center dark:bg-white/[0.08]">
            <p className={cn("text-sm", songCupMuted)}>
              No scheduled matchups yet. Check back when the battle stage opens.
            </p>
          </div>
        )}

        {!isLoading && scheduleMatchups.length > 0 && (
          <div className="flex flex-col gap-6">
            {scheduleMatchups.map((matchup) => (
              <SongCupVoteMatchupCard
                key={matchup.id}
                matchup={matchup}
                walletConnected={false}
                onVote={async () => false}
                displayMode="schedule"
                nowMs={now}
              />
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="mt-4 flex flex-col gap-6 border-t border-[#dc2bb3]/30 pt-6">
            <SongCupAdminMatchupForm
              matchups={matchups}
              onCreate={createScheduleMatchup}
              onUpdateStatus={updateMatchupStatus}
              onRemove={removeMatchup}
              scheduleMode
            />
          </div>
        )}
      </div>
    </SongCupVoteContentWell>
  );
}
