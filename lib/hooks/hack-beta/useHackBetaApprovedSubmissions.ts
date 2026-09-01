"use client";

import { useState, useEffect, useCallback } from "react";
import {
  hackBetaSubmissionsService,
  type HackBetaSubmission,
} from "@/lib/sdk/supabase/hack-beta-submissions";
import { logger } from "@/lib/utils/logger";

export function useHackBetaApprovedSubmissions() {
  const [submissions, setSubmissions] = useState<HackBetaSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await hackBetaSubmissionsService.listApproved();
      setSubmissions(rows);
    } catch (err) {
      logger.error("[useHackBetaApprovedSubmissions] failed:", err);
      setError("Failed to load gallery");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { submissions, isLoading, error, refetch };
}
