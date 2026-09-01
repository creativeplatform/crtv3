"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Player, PlayerLoading } from "@/components/Player/Player";
import { getDetailPlaybackSource } from "@/lib/hooks/livepeer/useDetailPlaybackSources";
import { useCreativeTVUrlResolve } from "@/hooks/useCreativeTVUrlResolve";
import { getCreativeTVEmbedUrlForParsed } from "@/lib/utils/creative-tv-url";
import { getInternalHref } from "@/lib/utils/linkify-post-text";
import type { Src } from "@livepeer/react";
import { cn } from "@/lib/utils/utils";
import { logger } from "@/lib/utils/logger";

type CreativeTVLinkPreviewProps = {
  url: string;
  compact?: boolean;
  className?: string;
};

export function CreativeTVLinkPreview({
  url,
  compact = false,
  className,
}: CreativeTVLinkPreviewProps) {
  const { state, resolveFromInput } = useCreativeTVUrlResolve();
  const [playbackSources, setPlaybackSources] = useState<Src[] | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  useEffect(() => {
    void resolveFromInput(url);
  }, [url, resolveFromInput]);

  useEffect(() => {
    if (state.status !== "resolved") {
      setPlaybackSources(null);
      setPlayerError(null);
      return;
    }

    const playbackId = state.result.playbackId;
    const controller = new AbortController();

    async function loadSources() {
      try {
        const sources = await getDetailPlaybackSource(playbackId, {
          signal: controller.signal,
        });
        setPlaybackSources(sources);
        if (!sources?.length) {
          setPlayerError("Unable to load playback sources.");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        logger.error("[CreativeTVLinkPreview] Failed to load playback sources:", error);
        setPlayerError("Unable to load playback sources.");
      }
    }

    void loadSources();
    return () => controller.abort();
  }, [state]);

  const fallbackUrl =
    state.status === "resolved"
      ? state.result.fallbackUrl
      : state.status === "fallback"
        ? state.result.fallbackUrl
        : undefined;

  const iframeSrc = useMemo(() => {
    const parsed =
      state.status === "resolved"
        ? state.result.parsed
        : state.status === "fallback"
          ? state.result.parsed
          : undefined;

    if (parsed) {
      return getCreativeTVEmbedUrlForParsed(parsed) ?? fallbackUrl;
    }

    return fallbackUrl;
  }, [state, fallbackUrl]);

  const showIframeFallback =
    state.status === "fallback" ||
    (state.status === "resolved" && (Boolean(playerError) || !playbackSources?.length));

  const resolvedTitle =
    state.status === "resolved" ? state.result.title ?? "Creative TV Video" : "Creative TV Video";

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className={cn("mt-2", compact && "mt-1", className)}>
        <PlayerLoading title="Loading Creative TV preview..." />
      </div>
    );
  }

  if (state.status === "resolved" && !showIframeFallback) {
    return (
      <div className={cn("mt-2 overflow-hidden rounded-lg border", compact && "mt-1", className)}>
        {playbackSources ? (
          <Player
            src={playbackSources}
            title={resolvedTitle}
            playbackId={state.result.playbackId}
            autoPlay={false}
          />
        ) : (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading playback...
          </div>
        )}
      </div>
    );
  }

  if (showIframeFallback && iframeSrc) {
    return (
      <div className={cn("mt-2 space-y-2", compact && "mt-1", className)}>
        <div className="overflow-hidden rounded-lg border">
          <iframe
            src={iframeSrc}
            title="Creative TV video"
            className="aspect-video w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            loading="lazy"
          />
        </div>
        {fallbackUrl &&
        state.status === "resolved" &&
        (state.result.parsed.kind === "discover" ||
          state.result.parsed.kind === "watch") ? (
          <Link
            href={getInternalHref(state.result.parsed)}
            className="text-xs text-violet-400 hover:text-violet-300 hover:underline"
          >
            Open on Creative TV
          </Link>
        ) : null}
      </div>
    );
  }

  return null;
}
