"use client";

import { useCallback, useEffect, useState } from "react";
import {
  songCupSubmissionsService,
  type SongCupSubmission,
} from "@/lib/sdk/supabase/song-cup-submissions";
import { logger } from "@/lib/utils/logger";

export function useSongCupUserSubmission(walletAddress: string | null | undefined) {
  const [submission, setSubmission] = useState<SongCupSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSubmission = useCallback(async () => {
    if (!walletAddress) {
      setSubmission(null);
      return;
    }
    setIsLoading(true);
    try {
      const row = await songCupSubmissionsService.getForWallet(walletAddress);
      setSubmission(row);
    } catch (err) {
      logger.error("[useSongCupUserSubmission] fetch failed:", err);
      setSubmission(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void fetchSubmission();
  }, [fetchSubmission]);

  return {
    submission,
    hasSubmitted: Boolean(submission),
    isLoading,
    refetch: fetchSubmission,
    setSubmission,
  };
}
