import { supabase } from './client';
import { serverLogger } from '@/lib/utils/logger';

export type SongCupVoteChoice = 'left' | 'right';

export interface SongCupVote {
  id: string;
  matchup_id: string;
  wallet_address: string;
  choice: SongCupVoteChoice;
  created_at: string;
}

export interface SongCupVoteTally {
  left: number;
  right: number;
  total: number;
  leftPct: number;
  rightPct: number;
}

export function tallyVotes(votes: Pick<SongCupVote, 'choice'>[]): SongCupVoteTally {
  const left = votes.filter((v) => v.choice === 'left').length;
  const right = votes.filter((v) => v.choice === 'right').length;
  const total = left + right;
  const leftPct = total > 0 ? Math.round((left / total) * 100) : 50;
  const rightPct = total > 0 ? Math.round((right / total) * 100) : 50;
  return { left, right, total, leftPct, rightPct };
}

export const songCupVotesService = {
  async listForMatchup(matchupId: string): Promise<SongCupVote[]> {
    try {
      const { data, error } = await supabase
        .from('song_cup_votes')
        .select('*')
        .eq('matchup_id', matchupId);

      if (error) {
        serverLogger.error('[songCupVotes] listForMatchup error:', error);
        return [];
      }

      return (data ?? []) as SongCupVote[];
    } catch (err) {
      serverLogger.error('[songCupVotes] listForMatchup exception:', err);
      return [];
    }
  },

  async listForMatchups(matchupIds: string[]): Promise<SongCupVote[]> {
    if (matchupIds.length === 0) return [];
    try {
      const { data, error } = await supabase
        .from('song_cup_votes')
        .select('*')
        .in('matchup_id', matchupIds);

      if (error) {
        serverLogger.error('[songCupVotes] listForMatchups error:', error);
        return [];
      }

      return (data ?? []) as SongCupVote[];
    } catch (err) {
      serverLogger.error('[songCupVotes] listForMatchups exception:', err);
      return [];
    }
  },

  async cast(
    matchupId: string,
    walletAddress: string,
    choice: SongCupVoteChoice,
  ): Promise<SongCupVote | null> {
    try {
      const { data, error } = await supabase
        .from('song_cup_votes')
        .upsert(
          {
            matchup_id: matchupId,
            wallet_address: walletAddress.toLowerCase(),
            choice,
          },
          { onConflict: 'matchup_id,wallet_address' },
        )
        .select('*')
        .single();

      if (error) {
        serverLogger.error('[songCupVotes] cast error:', error);
        return null;
      }

      return data as SongCupVote;
    } catch (err) {
      serverLogger.error('[songCupVotes] cast exception:', err);
      return null;
    }
  },

  async getUserVote(
    matchupId: string,
    walletAddress: string,
  ): Promise<SongCupVoteChoice | null> {
    try {
      const { data, error } = await supabase
        .from('song_cup_votes')
        .select('choice')
        .eq('matchup_id', matchupId)
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();

      if (error || !data) return null;
      return data.choice as SongCupVoteChoice;
    } catch {
      return null;
    }
  },
};
