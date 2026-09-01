import { supabase } from './client';
import { serverLogger } from '@/lib/utils/logger';

export interface SongCupSubmission {
  id: string;
  wallet_address: string;
  grove_url: string;
  grove_hash?: string | null;
  title?: string | null;
  description?: string | null;
  artist_handle?: string | null;
  email?: string | null;
  cover_url?: string | null;
  cover_hash?: string | null;
  attestation_uid?: string | null;
  post_id?: string | null;
  is_favorite: boolean;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at?: string | null;
}

export interface CreateSongCupSubmissionData {
  wallet_address: string;
  grove_url: string;
  grove_hash?: string;
  title?: string;
  description?: string;
  artist_handle?: string;
  email?: string;
  cover_url?: string;
  cover_hash?: string;
  attestation_uid?: string;
  post_id?: string;
}

export type CreateSongCupSubmissionResult =
  | { ok: true; submission: SongCupSubmission }
  | { ok: false; reason: "duplicate" | "error"; message?: string };

export const songCupSubmissionsService = {
  async getForWallet(walletAddress: string): Promise<SongCupSubmission | null> {
    try {
      const normalized = walletAddress.toLowerCase();
      const { data, error } = await supabase
        .from("song_cup_submissions")
        .select("*")
        .eq("wallet_address", normalized)
        .maybeSingle();

      if (error) {
        serverLogger.error("[songCupSubmissions] getForWallet error:", error);
        return null;
      }

      return (data as SongCupSubmission | null) ?? null;
    } catch (err) {
      serverLogger.error("[songCupSubmissions] getForWallet exception:", err);
      return null;
    }
  },

  async create(
    data: CreateSongCupSubmissionData,
    authHeaders: Record<string, string>,
  ): Promise<CreateSongCupSubmissionResult> {
    try {
      const res = await fetch('/api/song-cup/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        submission?: SongCupSubmission;
        error?: string | Record<string, unknown>;
      };

      if (!res.ok || !json.ok || !json.submission) {
        const message =
          typeof json.error === 'string'
            ? json.error
            : res.statusText || 'Submission failed';
        serverLogger.error('[songCupSubmissions] api create/upsert error:', {
          status: res.status,
          error: json.error,
        });
        return { ok: false, reason: 'error', message };
      }

      return { ok: true, submission: json.submission };
    } catch (err) {
      serverLogger.error('[songCupSubmissions] create exception:', err);
      return {
        ok: false,
        reason: 'error',
        message: err instanceof Error ? err.message : undefined,
      };
    }
  },

  async list(): Promise<SongCupSubmission[]> {
    try {
      const { data, error } = await supabase
        .from('song_cup_submissions')
        .select('*')
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        serverLogger.error('[songCupSubmissions] list error:', error);
        return [];
      }

      return (data ?? []) as SongCupSubmission[];
    } catch (err) {
      serverLogger.error('[songCupSubmissions] list exception:', err);
      return [];
    }
  },

  async updateStatus(id: string, status: SongCupSubmission['status']): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('song_cup_submissions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        serverLogger.error('[songCupSubmissions] updateStatus error:', error);
        return false;
      }

      return true;
    } catch (err) {
      serverLogger.error('[songCupSubmissions] updateStatus exception:', err);
      return false;
    }
  },

  async setFavorite(id: string, isFavorite: boolean): Promise<boolean> {
    try {
      const updates: Record<string, unknown> = {
        is_favorite: isFavorite,
        updated_at: new Date().toISOString(),
      };
      if (isFavorite) {
        updates.status = 'approved';
      }

      const { error } = await supabase
        .from('song_cup_submissions')
        .update(updates)
        .eq('id', id);

      if (error) {
        serverLogger.error('[songCupSubmissions] setFavorite error:', error);
        return false;
      }

      return true;
    } catch (err) {
      serverLogger.error('[songCupSubmissions] setFavorite exception:', err);
      return false;
    }
  },
};
