"use client";

import { useState, useEffect, useCallback } from "react";
import type { HackBetaSubmission } from "@/lib/sdk/supabase/hack-beta-submissions";
import { useHackBetaAdmin } from "@/lib/hooks/hack-beta/useHackBetaAdmin";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { logger } from "@/lib/utils/logger";

export function useHackBetaSubmissions(enabled: boolean = true) {
  const { isAdmin, walletAddress, isLoading: isAdminLoading } = useHackBetaAdmin();
  const { getAuthHeaders, isReady } = useWalletAuth();
  const [submissions, setSubmissions] = useState<HackBetaSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!enabled || isAdminLoading) return;
    if (!isAdmin || !isReady) {
      setSubmissions([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/hack-beta/admin/submissions", {
        method: "GET",
        headers: authHeaders,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Failed to load submissions (${res.status})`);
      }
      const json = (await res.json()) as { submissions?: HackBetaSubmission[] };
      setSubmissions(json.submissions ?? []);
    } catch (err) {
      logger.error("[useHackBetaSubmissions] fetch failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load submissions");
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, enabled, isAdminLoading, isReady, getAuthHeaders]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const patchSubmission = useCallback(
    async (body: {
      id: string;
      status?: HackBetaSubmission["status"];
      is_favorite?: boolean;
    }) => {
      if (!isReady) {
        logger.error("[useHackBetaSubmissions] patch skipped: wallet auth not ready");
        return false;
      }
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch("/api/hack-beta/admin/submissions", {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          logger.error("[useHackBetaSubmissions] patch failed:", errBody ?? res.status);
          return false;
        }
        return true;
      } catch (err) {
        logger.error("[useHackBetaSubmissions] patch exception:", err);
        return false;
      }
    },
    [getAuthHeaders, isReady],
  );

  const updateStatus = useCallback(
    async (id: string, status: HackBetaSubmission["status"]) => {
      const ok = await patchSubmission({ id, status });
      if (ok) {
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, status, updated_at: new Date().toISOString() } : s,
          ),
        );
      }
      return ok;
    },
    [patchSubmission],
  );

  const setFavorite = useCallback(
    async (id: string, isFavorite: boolean) => {
      const ok = await patchSubmission({ id, is_favorite: isFavorite });
      if (ok) {
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  is_favorite: isFavorite,
                  status: isFavorite ? "approved" : s.status,
                  updated_at: new Date().toISOString(),
                }
              : s,
          ),
        );
      }
      return ok;
    },
    [patchSubmission],
  );

  return {
    submissions,
    isLoading: isLoading || isAdminLoading || (isAdmin && !isReady),
    error,
    refetch: fetchRows,
    updateStatus,
    setFavorite,
    isAdmin,
    walletAddress,
    isAdminLoading,
    isReady,
  };
}
