"use client";

import { useState, useEffect, useCallback } from "react";
import {
  hackBetaSettingsService,
  type HackBetaSettings,
} from "@/lib/sdk/supabase/hack-beta-settings";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { logger } from "@/lib/utils/logger";

export function useHackBetaSettings() {
  const { getAuthHeaders, isReady } = useWalletAuth();
  const [settings, setSettings] = useState<HackBetaSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const row = await hackBetaSettingsService.get();
      setSettings(row);
    } catch (err) {
      logger.error("[useHackBetaSettings] failed:", err);
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const updateMixtapeUrl = useCallback(
    async (url: string | null, _updatedBy?: string | null) => {
      if (!isReady) {
        logger.error("[useHackBetaSettings] wallet auth not ready");
        return null;
      }
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch("/api/hack-beta/admin/settings", {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mixtape_playlist_url: url }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          logger.error("[useHackBetaSettings] update failed:", body ?? res.status);
          return null;
        }
        const json = (await res.json()) as { settings?: HackBetaSettings };
        if (json.settings) setSettings(json.settings);
        return json.settings ?? null;
      } catch (err) {
        logger.error("[useHackBetaSettings] update exception:", err);
        return null;
      }
    },
    [getAuthHeaders, isReady],
  );

  return {
    settings,
    mixtapePlaylistUrl: settings?.mixtape_playlist_url ?? null,
    isLoading,
    refetch,
    updateMixtapeUrl,
  };
}
