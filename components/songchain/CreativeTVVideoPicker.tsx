"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import VideoThumbnail from "@/components/Videos/VideoThumbnail";
import type { VideoAsset } from "@/lib/types/video-asset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CreativeTVVideoPickerProps = {
  videos: VideoAsset[];
  loading?: boolean;
  selected: VideoAsset | null;
  onSelect: (video: VideoAsset | null) => void;
  disabled?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CreativeTVVideoPicker({
  videos,
  loading,
  selected,
  onSelect,
  disabled,
}: CreativeTVVideoPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) => v.title.toLowerCase().includes(q));
  }, [videos, query]);

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener("resize", onReposition);
    // Capture scroll from nested overflow containers too
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updateMenuPosition]);

  if (disabled) {
    return (
      <p className="text-xs text-muted-foreground">
        Connect your wallet to attach a Creative TV video.
      </p>
    );
  }

  const menu =
    open &&
    menuPos &&
    typeof document !== "undefined" &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
        <div
          className="fixed z-50 max-h-72 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
          }}
        >
          <div className="border-b border-border/50 p-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your videos…"
              className="h-8 text-xs"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {loading && (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                Loading library…
              </li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="px-3 py-3 text-xs text-muted-foreground space-y-2">
                <p>No published videos found.</p>
                <Link
                  href="/upload"
                  className="text-violet-400 hover:underline"
                >
                  Upload a video
                </Link>
              </li>
            )}
            {filtered.map((video) => (
              <li key={video.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60"
                  onClick={() => {
                    onSelect(video);
                    setOpen(false);
                  }}
                >
                  <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-muted">
                    {video.playback_id ? (
                      <VideoThumbnail
                        playbackId={video.playback_id}
                        src={null}
                        title={video.title}
                        assetId={video.asset_id}
                        initialThumbnailUrl={
                          (video as { thumbnail_url?: string }).thumbnail_url ??
                          video.thumbnailUri
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{video.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDuration(video.duration)}
                      {video.views_count > 0
                        ? ` · ${video.views_count} views`
                        : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </>,
      document.body
    );

  return (
    <div className="space-y-2">
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={loading}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
        >
          <span className="truncate text-left">
            {selected ? selected.title : "Attach a Creative TV video (optional)"}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {menu}
      </div>

      {selected && (
        <div className="flex items-start gap-3 rounded-md border border-border/50 bg-muted/20 p-3">
          <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-muted">
            {selected.playback_id ? (
              <VideoThumbnail
                playbackId={selected.playback_id}
                src={null}
                title={selected.title}
                assetId={selected.asset_id}
                initialThumbnailUrl={
                  (selected as { thumbnail_url?: string }).thumbnail_url ??
                  selected.thumbnailUri
                }
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{selected.title}</p>
            <Link
              href={`/discover/${selected.asset_id}`}
              className="text-xs text-violet-400 hover:underline"
            >
              View on Creative TV
            </Link>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onSelect(null)}
            aria-label="Remove attached video"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
