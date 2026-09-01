import type { SongCupVoteChoice, SongCupVoteTally } from "@/lib/sdk/supabase/song-cup-votes";
import type { OrbPollVotersData } from "./types";

export function orbPollToTally(data: OrbPollVotersData | null | undefined): SongCupVoteTally {
  if (!data?.options?.length) {
    return { left: 0, right: 0, total: 0, leftPct: 50, rightPct: 50 };
  }

  const left = data.options[0]?.voteCount ?? 0;
  const right = data.options[1]?.voteCount ?? 0;
  const total = data.totalVotes ?? left + right;
  const leftPct = total > 0 ? Math.round((left / total) * 100) : 50;
  const rightPct = total > 0 ? Math.round((right / total) * 100) : 50;

  return { left, right, total, leftPct, rightPct };
}

export function orbPollUserChoice(
  data: OrbPollVotersData | null | undefined,
): SongCupVoteChoice | null {
  if (!data?.options?.length) return null;
  if (data.options[0]?.myVote) return "left";
  if (data.options[1]?.myVote) return "right";
  return null;
}
