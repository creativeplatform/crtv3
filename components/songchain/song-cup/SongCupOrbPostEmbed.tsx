"use client";

import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import {
  SongCupVoteEntryName,
  SongCupVoteEntryTag,
  SongCupVotePostFrame,
} from "./vote/SongCupVoteUi";

export type OrbPostPreview = {
  id: string;
  text: string;
  author: string;
  authorHandle?: string | null;
  mediaType?: string | null;
  playbackUrl?: string | null;
  thumbnailUrl?: string | null;
  orbUrl?: string;
};

type SongCupOrbPostEmbedProps = {
  orbUrl?: string | null;
  postId?: string | null;
  label?: string | null;
  sublabel?: string | null;
  className?: string;
  compact?: boolean;
  hideLabels?: boolean;
  selected?: boolean;
  onSelect?: () => void;
};

async function fetchOrbPost(orbUrl?: string | null, postId?: string | null) {
  const params = new URLSearchParams();
  if (postId) params.set("id", postId);
  else if (orbUrl) params.set("url", orbUrl);
  else return null;

  const res = await fetch(`/api/song-cup/orb-post?${params.toString()}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { post?: OrbPostPreview };
  return data.post ?? null;
}

export function SongCupOrbPostEmbed({
  orbUrl,
  postId,
  label,
  sublabel,
  className,
  compact = false,
  hideLabels = false,
  selected,
  onSelect,
}: SongCupOrbPostEmbedProps) {
  const [post, setPost] = useState<OrbPostPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchOrbPost(orbUrl, postId).then((result) => {
      if (cancelled) return;
      setPost(result);
      setError(!result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orbUrl, postId]);

  const displayLabel = label ?? post?.author ?? "Entry";
  const displaySub =
    sublabel ?? (post?.authorHandle ? post.authorHandle.toUpperCase() : post?.text?.slice(0, 24));

  const frame = (
    <SongCupVotePostFrame
      className={cn(!compact && "size-auto aspect-square w-full max-w-[140px]")}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#fe01dc]" />
        </div>
      )}
      {!loading && error && (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] text-white/60">
          Could not load post
        </div>
      )}
      {!loading && post && !playing && (
        <>
          {post.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.thumbnailUrl} alt="" className="size-full object-cover" />
          ) : null}
          {post.playbackUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPlaying(true);
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/20"
              aria-label="Play video"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-black/60">
                <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
              </span>
            </button>
          )}
        </>
      )}
      {!loading && post && playing && post.playbackUrl && (
        <video
          src={post.playbackUrl}
          controls
          autoPlay
          playsInline
          className="size-full object-cover"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </SongCupVotePostFrame>
  );

  const content = (
    <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
      {frame}
      {!hideLabels && (
        <div className="space-y-0.5">
          <SongCupVoteEntryName className="text-center">{displayLabel}</SongCupVoteEntryName>
          {displaySub && <SongCupVoteEntryTag className="text-center">{displaySub}</SongCupVoteEntryTag>}
        </div>
      )}
    </div>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "rounded-xl p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fe01dc]",
          selected && "ring-2 ring-[#feed01]",
        )}
      >
        {content}
      </button>
    );
  }

  return content;
}

export { fetchOrbPost };
