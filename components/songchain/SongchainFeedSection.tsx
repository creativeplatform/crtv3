"use client";

import { forwardRef, useImperativeHandle } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSongchainFeed } from "@/hooks/useSongchainFeed";
import { SongchainFeedInfoTooltip } from "./SongchainFeedInfoTooltip";
import { SongchainPostCard } from "@/components/songchain/SongchainPostCard";
import { SongchainPendingPostCard } from "@/components/songchain/SongchainPendingPostCard";
import {
  SongchainPostTimeline,
  SongchainPostTimelineItem,
} from "@/components/songchain/SongchainPostTimeline";
import { isQuotePost } from "@/lib/songchain/post-utils";
import { getFeedDiagnosticInfo } from "@/lib/songchain/feed-diagnostics";
import { cn } from "@/lib/utils/utils";
import type { SongchainCreatedPost } from "@/lib/songchain/feed-types";

type SongchainFeedSectionProps = {
  title: string;
  description: string;
  feedId: string | null;
  graphId?: string | null;
  emptyDescription: string;
  onPostUpdated?: () => void;
  /** When false, skips fetching posts (e.g. club feed before join). */
  enabled?: boolean;
  /** Disables like/comment/repost/bookmark actions on posts. */
  readOnly?: boolean;
  /** Enables a contained, scroll-driven animated feed where posts scale near the center. */
  animated?: boolean;
  /** Render posts as a 4-column grid (Song Cup) or the default single-column timeline. */
  layout?: "timeline" | "grid";
  /** Hide the title/description header block. */
  hideHeader?: boolean;
  /** Extra classes applied to every post card. */
  cardClassName?: string;
  /** Visual variant passed through to each post card. */
  cardVariant?: "default" | "song-cup";
};

export type SongchainFeedHandle = {
  registerNewPost: (created: SongchainCreatedPost) => void;
  reload: () => void;
};

function FeedDiagnostics({
  error,
  isEmpty,
}: {
  error: string | null;
  isEmpty: boolean;
}) {
  return (
    <div className="mb-2 rounded-md px-4 py-2 text-xs text-muted-foreground space-y-1">
      {error && (
        <p className="text-destructive">
          <span className="font-medium">API error:</span> {error}
        </p>
      )}
      {isEmpty && !error && (
        <p>
          Feed is reachable but has no posts yet. Posts must be created on this custom feed
          address (not the global Lens timeline).
        </p>
      )}
      {error && error.includes("not registered on") && (
        <p>
          Fix <code className="text-[10px]">NEXT_PUBLIC_SONGCHAIN_FEED_ID</code> in your
          deployment env, then redeploy. Use the feed contract address from the Lens / Orb
          dashboard — not the feed display name.
        </p>
      )}
    </div>
  );
}

export const SongchainFeedSection = forwardRef<SongchainFeedHandle, SongchainFeedSectionProps>(
  function SongchainFeedSection(
    { title, description, feedId, graphId = null, emptyDescription, onPostUpdated, enabled = true, readOnly = false, animated = false, layout = "timeline", hideHeader = false, cardClassName, cardVariant = "default" },
    ref,
  ) {
    const { posts, pendingPosts, loading, error, hasMore, reload, loadMore, registerNewPost } =
      useSongchainFeed({ feedId, enabled });

    useImperativeHandle(
      ref,
      () => ({ registerNewPost, reload }),
      [registerNewPost, reload],
    );

    if (!feedId) {
      const info = getFeedDiagnosticInfo(null);
      return (
        <section className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
          <p className="text-sm">Feed address not configured yet.</p>
          <p className="mt-3 text-xs">
            Set <code>NEXT_PUBLIC_SONGCHAIN_FEED_ID</code> ({info.lensNetworkLabel}) in your
            environment, then redeploy if needed.
          </p>
        </section>
      );
    }

    const hasVisiblePosts = posts.length > 0 || pendingPosts.length > 0;

    return (
      <section>
        {!hideHeader && (
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{title}</h2>
              <SongchainFeedInfoTooltip feedId={feedId} />
            </div>
            <p className="text-muted-foreground mt-1">{description}</p>
          </div>
        )}

        <FeedDiagnostics
          error={error}
          isEmpty={!loading && !hasVisiblePosts}
        />

        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Could not load posts.
            <Button variant="link" className="ml-2 h-auto p-0" onClick={() => reload()}>
              Retry
            </Button>
          </div>
        )}

        {loading && !hasVisiblePosts ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasVisiblePosts ? (
          <div className="mx-auto max-w-2xl rounded-lg border border-dashed border-border/60 p-8 text-center">
            <p className="font-medium text-foreground">No posts found in this feed yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">{emptyDescription}</p>
          </div>
        ) : layout === "grid" ? (
          <div
            className={cn(
              "grid gap-4",
              cardVariant === "song-cup"
                ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
              cardClassName,
            )}
          >
            {pendingPosts.map((pending) => (
              <SongchainPendingPostCard
                key={pending.localId}
                pending={pending}
                onRefresh={() => reload()}
              />
            ))}
            {posts.map((post) => (
              <SongchainPostCard
                key={post.id}
                post={post}
                feedId={feedId}
                graphId={graphId}
                compact
                readOnly={readOnly}
                variant={cardVariant}
                onReactionChange={reload}
                onPostUpdated={onPostUpdated}
              />
            ))}
          </div>
        ) : (
          <SongchainPostTimeline animated={animated}>
            {pendingPosts.map((pending) => (
              <SongchainPostTimelineItem key={pending.localId}>
                <SongchainPendingPostCard
                  pending={pending}
                  onRefresh={() => reload()}
                />
              </SongchainPostTimelineItem>
            ))}
            {posts.map((post) => (
              <SongchainPostTimelineItem key={post.id} isQuote={isQuotePost(post)}>
                <SongchainPostCard
                  post={post}
                  feedId={feedId}
                  graphId={graphId}
                  readOnly={readOnly}
                  onReactionChange={reload}
                  onPostUpdated={onPostUpdated}
                />
              </SongchainPostTimelineItem>
            ))}
          </SongchainPostTimeline>
        )}

        {hasMore && (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" disabled={loading} onClick={() => void loadMore()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load more
            </Button>
          </div>
        )}
      </section>
    );
  },
);
