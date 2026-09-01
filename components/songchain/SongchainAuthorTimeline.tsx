"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPosts } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/types";
import type { AnyPost } from "@lens-protocol/graphql";
import { publicClient } from "@/lib/sdk/lens/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SongchainPostCard } from "@/components/songchain/SongchainPostCard";
import { normalizeFeedPosts } from "@/lib/songchain/post-utils";

type SongchainAuthorTimelineProps = {
  authorAddress: string;
  authorLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SongchainAuthorTimeline({
  authorAddress,
  authorLabel,
  open,
  onOpenChange,
}: SongchainAuthorTimelineProps) {
  const [posts, setPosts] = useState<AnyPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authorAddress) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPosts(publicClient, {
        filter: {
          authors: [evmAddress(authorAddress)],
        },
      });
      if (result.isErr()) throw new Error(result.error.message);
      setPosts(normalizeFeedPosts(result.value.items));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [authorAddress]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Timeline — {authorLabel}</DialogTitle>
        </DialogHeader>
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && posts.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No posts found.</p>
        )}
        <div className="space-y-4">
          {posts.map((post) => (
            <SongchainPostCard
              key={post.id}
              post={post}
              compact
              onReactionChange={load}
            />
          ))}
        </div>
        {posts.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
