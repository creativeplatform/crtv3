"use client";

import { useEffect, useState } from "react";
import type { ShoppableAnnotation } from "@/components/Player/ShoppableOverlay";
import { logger } from "@/lib/utils/logger";

export function useShoppableAnnotations(playbackId?: string | null) {
  const [annotations, setAnnotations] = useState<ShoppableAnnotation[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  useEffect(() => {
    if (!playbackId) {
      setAnnotations([]);
      setCampaignId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/campaigns/by-playback/${encodeURIComponent(playbackId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCampaignId(data.campaignId ?? null);
        setAnnotations(Array.isArray(data.annotations) ? data.annotations : []);
      } catch (err) {
        if (!cancelled) {
          logger.warn("[useShoppableAnnotations]", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playbackId]);

  return { annotations, campaignId };
}
