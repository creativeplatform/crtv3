"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSongchainPost } from "@/hooks/useSongchainPost";
import type { StreamSummary } from "@/lib/songchain/build-lens-livestream-metadata";
import Link from "next/link";

type SongchainShareLiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stream: StreamSummary;
  feedId: string | null;
  onPosted?: () => void;
};

export function SongchainShareLiveDialog({
  open,
  onOpenChange,
  stream,
  feedId,
  onPosted,
}: SongchainShareLiveDialogProps) {
  const [content, setContent] = useState("");
  const { createPost, isPosting, canWrite, needsOrbReauth, promptWriteAccess } =
    useSongchainPost();

  const handlePost = async () => {
    if (!feedId) return;
    const created = await createPost({
      content,
      feedId,
      attachedLiveStream: stream,
    });
    if (created) {
      setContent("");
      onOpenChange(false);
      onPosted?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share live stream to Songchain</DialogTitle>
        </DialogHeader>
        {!feedId ? (
          <p className="text-sm text-muted-foreground">
            Songchain feed is not configured. Set{" "}
            <code className="text-xs">NEXT_PUBLIC_SONGCHAIN_FEED_ID</code> in your environment.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Post your live stream to the Songchain Lens feed with an optional caption.
            </p>
            {!canWrite && (
              <p className="text-xs text-muted-foreground">
                {needsOrbReauth
                  ? "Sign in again with Orb to post."
                  : "Connect wallet and link Orb to post."}
              </p>
            )}
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tell your audience you're live…"
              rows={3}
              disabled={isPosting}
            />
            <div className="flex justify-between gap-2">
              {!canWrite ? (
                <Button type="button" variant="outline" size="sm" onClick={promptWriteAccess}>
                  {needsOrbReauth ? "Sign in again" : "Link Orb"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={isPosting || !stream.is_live}
                  onClick={() => void handlePost()}
                >
                  {isPosting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Post to Songchain
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/songchain">Open Songchain</Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
