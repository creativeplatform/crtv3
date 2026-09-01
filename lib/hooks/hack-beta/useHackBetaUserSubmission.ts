"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/lib/wallet/react";
import { isHackBetaAdminWallet } from "@/lib/chones/hack-beta/admin-config";
import {
  hackBetaSubmissionsService,
  type HackBetaSubmission,
} from "@/lib/sdk/supabase/hack-beta-submissions";
import { logger } from "@/lib/utils/logger";

export function useHackBetaUserSubmission(walletAddress?: string | null) {
  const user = useUser();
  const address = walletAddress ?? user?.address ?? null;
  const isAdmin = isHackBetaAdminWallet(address);
  const [submission, setSubmission] = useState<HackBetaSubmission | null>(null);
  const [submissions, setSubmissions] = useState<HackBetaSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!address) {
      setSubmission(null);
      setSubmissions([]);
      return;
    }
    setIsLoading(true);
    try {
      const rows = await hackBetaSubmissionsService.listForWallet(address);
      setSubmissions(rows);
      setSubmission(rows[0] ?? null);
    } catch (err) {
      logger.error("[useHackBetaUserSubmission] failed:", err);
      setSubmission(null);
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    submission,
    submissions,
    /** Non-admins are locked after one entry; admins may keep submitting. */
    hasSubmitted: Boolean(submission) && !isAdmin,
    isAdmin,
    isLoading,
    setSubmission: (row: HackBetaSubmission | null) => {
      setSubmission(row);
      if (row) {
        setSubmissions((prev) => {
          const without = prev.filter((s) => s.id !== row.id);
          return [row, ...without];
        });
      }
    },
    reload,
  };
}
