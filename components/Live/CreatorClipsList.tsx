"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Scissors, ExternalLink } from "lucide-react";

interface ClipRow {
  id: number;
  title: string | null;
  playback_id: string;
  thumbnail_url: string | null;
  status: string | null;
  is_minted: boolean | null;
  duration: number | null;
  clip_start_ms: number | null;
  clip_end_ms: number | null;
  clipper_address: string | null;
  token_id: string | null;
  story_ip_id: string | null;
  contract_address: string | null;
  created_at: string;
}

interface CreatorClipsListProps {
  playbackId: string;
  refreshKey?: number;
}

const STORY_SCAN_BASE =
  process.env.NEXT_PUBLIC_STORY_NETWORK === "mainnet"
    ? "https://www.storyscan.io"
    : "https://aeneid.storyscan.io";

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function CreatorClipsList({ playbackId, refreshKey = 0 }: CreatorClipsListProps) {
  const [clips, setClips] = useState<ClipRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!playbackId) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/video-assets/clips/by-parent/${encodeURIComponent(playbackId)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || `Failed to load clips (${res.status})`);
          return;
        }
        setClips(data.clips ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load clips");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [playbackId, refreshKey]);

  return (
    <div className="mt-4 border-t border-white/20 pt-3 max-w-[576px] mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <Scissors className="h-4 w-4" />
        <p className="text-sm font-semibold">Clips from your stream</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && clips && clips.length === 0 && (
        <p className="text-xs text-gray-400">
          No clips yet. Viewers can create clips once you&apos;re live.
        </p>
      )}

      {clips && clips.length > 0 && (
        <ul className="space-y-2">
          {clips.map((clip) => {
            const duration =
              clip.clip_start_ms != null && clip.clip_end_ms != null
                ? clip.clip_end_ms - clip.clip_start_ms
                : clip.duration != null
                  ? clip.duration * 1000
                  : null;
            return (
              <li
                key={clip.id}
                className="flex items-center gap-3 p-2 rounded-md border border-white/10 bg-muted/10"
              >
                <div className="w-20 h-12 flex-shrink-0 rounded overflow-hidden bg-black/40">
                  {clip.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={clip.thumbnail_url}
                      alt={clip.title ?? "Clip thumbnail"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                      no preview
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate" title={clip.title ?? undefined}>
                      {clip.title ?? "Untitled clip"}
                    </p>
                    <Badge variant={clip.is_minted ? "default" : "secondary"}>
                      {clip.is_minted ? "minted" : clip.status ?? "draft"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    {formatDuration(duration)} · by {shortAddr(clip.clipper_address)}
                  </p>
                  {clip.is_minted && clip.story_ip_id && (
                    <a
                      href={`${STORY_SCAN_BASE}/ip/${clip.story_ip_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                    >
                      View IP <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
