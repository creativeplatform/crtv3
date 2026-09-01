import { getSrc } from "@livepeer/react/external";
import { Src } from "@livepeer/react";
import { LIVEPEER_HERO_PLAYBACK_ID } from "../../../context/context";
import { logger } from '@/lib/utils/logger';

export type HeroPlaybackSource = {
  src: Src[];
  playbackId: string;
};

/**
 * Resolves playback sources for the homepage hero intro video.
 * Uses the static LIVEPEER_HERO_PLAYBACK_ID from context — not the app video library —
 * so the hero keeps working if the asset is removed from Supabase.
 */
export const getHeroPlaybackSource = async (): Promise<HeroPlaybackSource | null> => {
  try {
    const playbackId = LIVEPEER_HERO_PLAYBACK_ID;

    const playbackResponse = await fetch(
      `/api/internal/playback-info?playbackId=${encodeURIComponent(playbackId)}`,
    );
    if (!playbackResponse.ok) {
      throw new Error(
        `Failed to fetch playback info: ${playbackResponse.status} ${playbackResponse.statusText}`,
      );
    }

    const playbackInfo = await playbackResponse.json();
    const src = getSrc(playbackInfo) as Src[];
    if (!src?.length) {
      return null;
    }
    return { src, playbackId };
  } catch (error) {
    logger.error("Error fetching hero playback source:", error);
    return null;
  }
};
