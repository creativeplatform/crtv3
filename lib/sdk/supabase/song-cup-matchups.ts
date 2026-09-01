import { supabase } from './client';
import { serverLogger } from '@/lib/utils/logger';

export type SongCupMatchupStatus = 'upcoming' | 'active' | 'past';

export interface SongCupMatchup {
  id: string;
  title: string;
  subtitle?: string | null;
  left_orb_url: string;
  right_orb_url: string;
  left_post_id?: string | null;
  right_post_id?: string | null;
  left_label?: string | null;
  right_label?: string | null;
  poll_post_id?: string | null;
  status: SongCupMatchupStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface CreateSongCupMatchupData {
  title: string;
  subtitle?: string;
  left_orb_url: string;
  right_orb_url: string;
  left_post_id?: string;
  right_post_id?: string;
  left_label?: string;
  right_label?: string;
  poll_post_id?: string;
  status?: SongCupMatchupStatus;
  starts_at?: string;
  ends_at?: string;
}

export const songCupMatchupsService = {
  async list(): Promise<SongCupMatchup[]> {
    try {
      const { data, error } = await supabase
        .from('song_cup_matchups')
        .select('*')
        .order('starts_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) {
        serverLogger.error('[songCupMatchups] list error:', error);
        return [];
      }

      return (data ?? []) as SongCupMatchup[];
    } catch (err) {
      serverLogger.error('[songCupMatchups] list exception:', err);
      return [];
    }
  },

  async create(data: CreateSongCupMatchupData): Promise<SongCupMatchup | null> {
    try {
      const { data: row, error } = await supabase
        .from('song_cup_matchups')
        .insert({
          title: data.title,
          subtitle: data.subtitle ?? null,
          left_orb_url: data.left_orb_url,
          right_orb_url: data.right_orb_url,
          left_post_id: data.left_post_id ?? null,
          right_post_id: data.right_post_id ?? null,
          left_label: data.left_label ?? null,
          right_label: data.right_label ?? null,
          poll_post_id: data.poll_post_id ?? null,
          status: data.status ?? 'upcoming',
          starts_at: data.starts_at ?? null,
          ends_at: data.ends_at ?? null,
        })
        .select('*')
        .single();

      if (error) {
        serverLogger.error('[songCupMatchups] insert error:', error);
        return null;
      }

      return row as SongCupMatchup;
    } catch (err) {
      serverLogger.error('[songCupMatchups] create exception:', err);
      return null;
    }
  },

  async updatePollPostId(id: string, pollPostId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('song_cup_matchups')
        .update({ poll_post_id: pollPostId, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        serverLogger.error('[songCupMatchups] updatePollPostId error:', error);
        return false;
      }

      return true;
    } catch (err) {
      serverLogger.error('[songCupMatchups] updatePollPostId exception:', err);
      return false;
    }
  },

  async updateStatus(id: string, status: SongCupMatchupStatus): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('song_cup_matchups')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        serverLogger.error('[songCupMatchups] updateStatus error:', error);
        return false;
      }

      return true;
    } catch (err) {
      serverLogger.error('[songCupMatchups] updateStatus exception:', err);
      return false;
    }
  },

  async remove(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('song_cup_matchups').delete().eq('id', id);
      if (error) {
        serverLogger.error('[songCupMatchups] remove error:', error);
        return false;
      }
      return true;
    } catch (err) {
      serverLogger.error('[songCupMatchups] remove exception:', err);
      return false;
    }
  },
};
