"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  songCupMatchupsService,
  type SongCupMatchup,
  type SongCupMatchupStatus,
} from "@/lib/sdk/supabase/song-cup-matchups";
import {
  songCupVotesService,
  tallyVotes,
  type SongCupVote,
  type SongCupVoteChoice,
  type SongCupVoteTally,
} from "@/lib/sdk/supabase/song-cup-votes";
import { orbPollToTally, orbPollUserChoice } from "@/lib/sdk/orb/polls/tally";
import type { OrbPollVotersData } from "@/lib/sdk/orb/polls/types";
import { useSongCupOrbPollVote } from "@/lib/hooks/song-cup/useSongCupOrbPollVote";
import { useSongCupOrbPollCreate } from "@/lib/hooks/song-cup/useSongCupOrbPollCreate";
import { useOrbSession } from "@/lib/hooks/orb/useOrbSession";
import { logger } from "@/lib/utils/logger";

export type SongCupMatchupWithVotes = SongCupMatchup & {
  votes: SongCupVote[];
  tally: SongCupVoteTally;
  userChoice: SongCupVoteChoice | null;
  pollData?: OrbPollVotersData | null;
  usesOrbPoll: boolean;
};

export type SongCupMatchupFilter = "upcoming" | "past" | "all";

function filterMatchups(
  matchups: SongCupMatchup[],
  filter: SongCupMatchupFilter,
): SongCupMatchup[] {
  if (filter === "all") return matchups;
  return matchups.filter((m) => m.status === filter);
}

async function fetchPollResults(
  pollPostId: string,
  accessToken?: string | null,
): Promise<OrbPollVotersData | null> {
  try {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (accessToken?.trim()) {
      headers.Authorization = `Bearer ${accessToken.trim()}`;
    }

    const res = await fetch("/api/song-cup/orb-polls/get-voters", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: pollPostId, limit: 25 }),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { data?: OrbPollVotersData };
    return json.data ?? null;
  } catch (err) {
    logger.error("[fetchPollResults] failed for id:", pollPostId, err);
    return null;
  }
}

export function useSongCupMatchups(
  walletAddress: string | null,
  filter: SongCupMatchupFilter = "all",
) {
  const { session } = useOrbSession();
  const { voteOnPoll } = useSongCupOrbPollVote();
  const { createPollPost } = useSongCupOrbPollCreate();

  const [matchups, setMatchups] = useState<SongCupMatchup[]>([]);
  const [votes, setVotes] = useState<SongCupVote[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, OrbPollVotersData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPollResults = useCallback(
    async (rows: SongCupMatchup[]) => {
      const pollIds = rows
        .map((m) => m.poll_post_id?.trim())
        .filter((id): id is string => Boolean(id));

      if (pollIds.length === 0) {
        setPollResults({});
        return;
      }

      const token = session?.accessToken ?? null;
      const entries = await Promise.all(
        pollIds.map(async (id) => {
          const data = await fetchPollResults(id, token);
          return [id, data] as const;
        }),
      );

      const next: Record<string, OrbPollVotersData> = {};
      for (const [id, data] of entries) {
        if (data) next[id] = data;
      }
      setPollResults(next);
    },
    [session?.accessToken],
  );

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await songCupMatchupsService.list();
      setMatchups(rows);

      const legacyIds = rows.filter((r) => !r.poll_post_id).map((r) => r.id);
      if (legacyIds.length > 0) {
        const voteRows = await songCupVotesService.listForMatchups(legacyIds);
        setVotes(voteRows);
      } else {
        setVotes([]);
      }

      await loadPollResults(rows);
    } catch (err) {
      logger.error("[useSongCupMatchups] fetch failed:", err);
      setError("Failed to load matchups");
    } finally {
      setIsLoading(false);
    }
  }, [loadPollResults]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const enriched = useMemo((): SongCupMatchupWithVotes[] => {
    const filtered = filterMatchups(matchups, filter);
    return filtered.map((matchup) => {
      const usesOrbPoll = Boolean(matchup.poll_post_id?.trim());
      const pollData = matchup.poll_post_id
        ? (pollResults[matchup.poll_post_id] ?? null)
        : null;

      if (usesOrbPoll) {
        return {
          ...matchup,
          votes: [],
          tally: orbPollToTally(pollData),
          userChoice: orbPollUserChoice(pollData),
          pollData,
          usesOrbPoll: true,
        };
      }

      const matchupVotes = votes.filter((v) => v.matchup_id === matchup.id);
      const userVote = walletAddress
        ? (matchupVotes.find(
            (v) => v.wallet_address.toLowerCase() === walletAddress.toLowerCase(),
          )?.choice ?? null)
        : null;

      return {
        ...matchup,
        votes: matchupVotes,
        tally: tallyVotes(matchupVotes),
        userChoice: userVote,
        pollData: null,
        usesOrbPoll: false,
      };
    });
  }, [matchups, votes, filter, walletAddress, pollResults]);

  const castVote = useCallback(
    async (matchupId: string, choice: SongCupVoteChoice) => {
      const matchup = matchups.find((m) => m.id === matchupId);
      if (!matchup) return false;

      if (matchup.poll_post_id?.trim()) {
        const ok = await voteOnPoll(matchup.poll_post_id, choice);
        if (ok) {
          await loadPollResults(matchups);
        }
        return ok;
      }

      if (!walletAddress) return false;
      const row = await songCupVotesService.cast(matchupId, walletAddress, choice);
      if (!row) return false;
      setVotes((prev) => {
        const without = prev.filter(
          (v) =>
            !(
              v.matchup_id === matchupId &&
              v.wallet_address.toLowerCase() === walletAddress.toLowerCase()
            ),
        );
        return [...without, row];
      });
      return true;
    },
    [matchups, walletAddress, voteOnPoll, loadPollResults],
  );

  const createMatchup = useCallback(
    async (
      data: Parameters<typeof songCupMatchupsService.create>[0],
      options?: { skipPoll?: boolean },
    ) => {
      let pollPostId = data.poll_post_id?.trim() || null;

      if (
        !options?.skipPoll &&
        !pollPostId &&
        data.left_label &&
        data.right_label
      ) {
        pollPostId = await createPollPost({
          title: data.title,
          leftLabel: data.left_label,
          rightLabel: data.right_label,
          endsAt: data.ends_at ?? null,
        });
      }

      const row = await songCupMatchupsService.create({
        ...data,
        poll_post_id: pollPostId ?? undefined,
      });

      if (row) {
        setMatchups((prev) => [row, ...prev]);
        if (row.poll_post_id) {
          await loadPollResults([row, ...matchups]);
        }
      }
      return row;
    },
    [createPollPost, loadPollResults, matchups],
  );

  const updateMatchupStatus = useCallback(async (id: string, status: SongCupMatchupStatus) => {
    const ok = await songCupMatchupsService.updateStatus(id, status);
    if (ok) {
      setMatchups((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status, updated_at: new Date().toISOString() } : m)),
      );
    }
    return ok;
  }, []);

  const removeMatchup = useCallback(async (id: string) => {
    const ok = await songCupMatchupsService.remove(id);
    if (ok) {
      setMatchups((prev) => prev.filter((m) => m.id !== id));
      setVotes((prev) => prev.filter((v) => v.matchup_id !== id));
    }
    return ok;
  }, []);

  return {
    matchups: enriched,
    isLoading,
    error,
    refetch: fetchAll,
    castVote,
    createMatchup,
    updateMatchupStatus,
    removeMatchup,
  };
}
