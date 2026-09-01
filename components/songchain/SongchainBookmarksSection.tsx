"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSongchainBookmarks } from "@/hooks/useSongchainBookmarks";
import { SongchainPostCard } from "@/components/songchain/SongchainPostCard";
import {
  SongchainPostTimeline,
  SongchainPostTimelineItem,
} from "@/components/songchain/SongchainPostTimeline";
import { isQuotePost } from "@/lib/songchain/post-utils";

import type { SongchainConfig } from "@/lib/songchain/config";

type SongchainBookmarksSectionProps = {
  graphId?: string | null;
};

export function SongchainBookmarksSection({
  graphId = null,
}: SongchainBookmarksSectionProps) {
  const { posts, loading, error, reload, canWrite, promptWriteAccess } =
    useSongchainBookmarks();

  if (!canWrite) {
    return (
      <section className="rounded-lg border border-dashed border-border/60 p-8 text-center">
        <p className="text-muted-foreground mb-4">
          Sign in with Orb and link your profile to view saved bookmarks.
        </p>
        <Button variant="outline" onClick={promptWriteAccess}>
          Link Orb account
        </Button>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Bookmarks</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Posts you saved on Lens.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => reload()}>
          Refresh
        </Button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      {loading && posts.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No bookmarks yet.</p>
      ) : (
        <SongchainPostTimeline>
          {posts.map((post) => (
            <SongchainPostTimelineItem key={post.id} isQuote={isQuotePost(post)}>
              <SongchainPostCard
                post={post}
                graphId={graphId}
                onReactionChange={reload}
              />
            </SongchainPostTimelineItem>
          ))}
        </SongchainPostTimeline>
      )}
    </section>
  );
}
