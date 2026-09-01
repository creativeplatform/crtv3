import { supabase } from './client';
import { serverLogger } from '@/lib/utils/logger';

export interface HackBetaSettings {
  id: string;
  mixtape_playlist_url: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

export const hackBetaSettingsService = {
  async get(): Promise<HackBetaSettings | null> {
    try {
      const { data, error } = await supabase
        .from('hack_beta_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        serverLogger.error('[hackBetaSettings] get error:', error);
        return null;
      }

      return (data as HackBetaSettings | null) ?? null;
    } catch (err) {
      serverLogger.error('[hackBetaSettings] get exception:', err);
      return null;
    }
  },

  async updateMixtapeUrl(
    url: string | null,
    updatedBy?: string | null,
  ): Promise<HackBetaSettings | null> {
    try {
      const { data, error } = await supabase
        .from('hack_beta_settings')
        .update({
          mixtape_playlist_url: url?.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy?.toLowerCase() ?? null,
        })
        .eq('id', 'default')
        .select('*')
        .single();

      if (error) {
        serverLogger.error('[hackBetaSettings] updateMixtapeUrl error:', error);
        return null;
      }

      return data as HackBetaSettings;
    } catch (err) {
      serverLogger.error('[hackBetaSettings] updateMixtapeUrl exception:', err);
      return null;
    }
  },
};
