"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import type { PendingFeedPost } from "@/lib/songchain/feed-types";
import { Button } from "@/components/ui/button";

type SongchainPendingPostCardProps = {
  pending: PendingFeedPost;
  onRefresh?: () => void;
};

export function SongchainPendingPostCard({
  pending,
  onRefresh,
}: SongchainPendingPostCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-violet-500/30 bg-card/60 opacity-90 shadow-sm">
      {pending.thumbnailUrl && (
        <div className="relative aspect-video w-full bg-muted">
          <Image
            src={pending.thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 768px, 896px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-xs text-violet-400">
          {pending.timedOut ? (
            <span>Publishing is taking longer than expected.</span>
          ) : (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Publishing…</span>
            </>
          )}
        </div>
        {pending.title && (
          <p className="text-sm font-medium leading-relaxed">{pending.title}</p>
        )}
        {pending.content && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {pending.content}
          </p>
        )}
        {pending.timedOut && onRefresh && (
          <Button variant="outline" size="sm" className="w-fit" onClick={onRefresh}>
            Refresh feed
          </Button>
        )}
      </div>
    </article>
  );
}
