"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  OrbEventDayGroup,
  OrbFootballEvent,
  OrbEventGamesResponse,
} from "@/lib/songchain/song-cup/orb-event-types";
import { gameHasLivePeriod } from "@/lib/songchain/song-cup/predict-format";
import { useOrbSession } from "@/lib/hooks/orb/useOrbSession";
import { logger } from "@/lib/utils/logger";

const LIVE_POLL_MS = 30_000;

export function useSongCupOrbGames() {
  const { session } = useOrbSession();
  const [event, setEvent] = useState<OrbFootballEvent | null>(null);
  const [dayGroups, setDayGroups] = useState<OrbEventDayGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    setError(null);
    try {
      const headers: HeadersInit = {};
      const token = session?.accessToken?.trim();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch("/api/song-cup/orb-event/games", {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = (await res.json()) as OrbEventGamesResponse;
      setEvent(json.data.event);
      setDayGroups(json.data.items ?? []);
    } catch (err) {
      logger.error("[useSongCupOrbGames] fetch failed:", err);
      setError("Failed to load games");
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    setIsLoading(true);
    void fetchGames();
  }, [fetchGames]);

  const allGames = useMemo(
    () => dayGroups.flatMap((group) => group.games),
    [dayGroups],
  );

  const shouldPoll = useMemo(() => gameHasLivePeriod(allGames), [allGames]);

  useEffect(() => {
    if (!shouldPoll) return;
    const id = window.setInterval(() => {
      void fetchGames();
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [shouldPoll, fetchGames]);

  return {
    event,
    dayGroups,
    isLoading,
    error,
    refetch: fetchGames,
  };
}
