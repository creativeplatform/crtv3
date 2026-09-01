"use client";

import { useMemo, useState } from "react";
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
import { clipToVideoAsset, type ClipLensShareInput } from "@/lib/songchain/clip-to-video-asset";
import Link from "next/link";

type SongchainShareClipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clip: ClipLensShareInput;
  feedId: string | null;
  onPosted?: () => void;
};

export function SongchainShareClipDialog({
  open,
  onOpenChange,
  clip,
  feedId,
  onPosted,
}: SongchainShareClipDialogProps) {
  const [content, setContent] = useState("");
  const { createPost, isPosting, canWrite, needsOrbReauth, promptWriteAccess } =
    useSongchainPost();

  const videoAsset = useMemo(() => clipToVideoAsset(clip), [clip]);

  const handlePost = async () => {
    if (!feedId) return;
    const created = await createPost({
      content,
      feedId,
      attachedVideo: videoAsset,
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
          <DialogTitle>Share clip to Songchain</DialogTitle>
        </DialogHeader>
        {!feedId ? (
          <p className="text-sm text-muted-foreground">
            Songchain feed is not configured. Set{" "}
            <code className="text-xs">NEXT_PUBLIC_SONGCHAIN_FEED_ID</code> in your environment.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium truncate" title={clip.title}>
              {clip.title}
            </p>
            <p className="text-sm text-muted-foreground">
              Post this clip to the Songchain Lens feed with an optional caption.
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
              placeholder="What happened in this moment?"
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
                  disabled={isPosting}
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
