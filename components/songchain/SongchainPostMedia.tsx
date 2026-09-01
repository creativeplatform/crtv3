"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Music, Radio, Video } from "lucide-react";
import type { PostMediaItem } from "@/lib/songchain/post-utils";
import { cn } from "@/lib/utils/utils";

type SongchainPostMediaProps = {
  media: PostMediaItem[];
  compact?: boolean;
};

const FEED_MEDIA_SIZES = "(max-width: 768px) 100vw, (max-width: 1280px) 768px, 896px";
const FEED_AUDIO_COVER_SIZES = "64px";

function extractPlaybackIdFromUrl(url: string): string | null {
  const match = url.match(/\/watch\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function LiveStreamBlock({
  item,
  compact,
}: {
  item: PostMediaItem;
  compact?: boolean;
}) {
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const playbackId = extractPlaybackIdFromUrl(item.url) ?? extractPlaybackIdFromUrl(item.url.replace(/^https?:\/\/[^/]+/, ""));
  const watchHref = playbackId ? `/watch/${playbackId}` : null;

  useEffect(() => {
    if (!item.checkLiveApi) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(item.checkLiveApi!, { cache: "no-store" });
        const data = (await res.json()) as { isLive?: boolean };
        if (!cancelled) setIsLive(Boolean(data.isLive));
      } catch {
        if (!cancelled) setIsLive(false);
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [item.checkLiveApi]);

  const liveLabel =
    isLive === null ? "LIVE" : isLive ? "LIVE" : "ENDED";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/40 bg-muted",
        compact ? "max-h-40" : "aspect-video",
      )}
    >
      {item.cover ? (
        <Image
          src={item.cover}
          alt=""
          fill
          sizes={FEED_MEDIA_SIZES}
          className="object-cover opacity-80"
          unoptimized
        />
      ) : (
        <div className="flex h-full min-h-[8rem] items-center justify-center bg-gradient-to-br from-violet-950/80 to-slate-950">
          <Radio className="h-10 w-10 text-violet-300" />
        </div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 p-4 text-center">
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            isLive === false
              ? "bg-muted text-muted-foreground"
              : "bg-red-600 text-white",
          )}
        >
          {liveLabel}
        </span>
        {item.title && (
          <p className="text-sm font-semibold text-white drop-shadow">{item.title}</p>
        )}
        {watchHref && (
          <Link
            href={watchHref}
            className="text-xs text-violet-200 underline hover:text-white"
          >
            Watch live stream
          </Link>
        )}
      </div>
    </div>
  );
}

function MediaBlock({ item, compact }: { item: PostMediaItem; compact?: boolean }) {
  if (item.type === "image") {
    return (
      <div className={cn("relative w-full bg-muted", compact ? "aspect-video max-h-36" : "aspect-video")}>
        <Image
          src={item.url}
          alt=""
          fill
          sizes={FEED_MEDIA_SIZES}
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  if (item.type === "video") {
    return (
      <div className={cn("w-full bg-black", compact ? "max-h-48" : "")}>
        <video
          controls
          playsInline
          preload="metadata"
          poster={item.cover ?? undefined}
          className={cn("w-full", compact ? "max-h-48" : "aspect-video")}
          src={item.url}
        />
      </div>
    );
  }

  if (item.type === "audio") {
    return (
      <div className="flex gap-3 rounded-lg border border-border/40 bg-muted/30 p-3">
        {item.cover ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded">
            <Image
              src={item.cover}
              alt=""
              fill
              sizes={FEED_AUDIO_COVER_SIZES}
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-muted">
            <Music className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {item.title && <p className="text-xs font-medium truncate">{item.title}</p>}
          <audio controls preload="metadata" className="w-full h-8" src={item.url} />
        </div>
      </div>
    );
  }

  if (item.type === "livestream") {
    return <LiveStreamBlock item={item} compact={compact} />;
  }

  return null;
}

export function SongchainPostMedia({ media, compact = false }: SongchainPostMediaProps) {
  const validMedia = useMemo(() => media.filter((m) => m.url), [media]);

  if (validMedia.length === 0) return null;

  return (
    <div className={cn("space-y-2", compact && "text-sm")}>
      {validMedia.map((item, index) => (
        <MediaBlock key={`${item.type}-${item.url}-${index}`} item={item} compact={compact} />
      ))}
    </div>
  );
}

export function SongchainPostMediaPlaceholder({ type }: { type: PostMediaItem["type"] }) {
  const Icon =
    type === "audio" ? Music : type === "video" ? Video : type === "livestream" ? Radio : ImageIcon;
  return (
    <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Icon className="h-8 w-8 opacity-50" />
    </div>
  );
}
