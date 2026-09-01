"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Radio, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSongchainPost } from "@/hooks/useSongchainPost";
import { useCreatorLiveStream } from "@/hooks/useCreatorLiveStream";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { GroveVideoUploader } from "@/components/songchain/GroveVideoUploader";
import { songCupSubmissionsService } from "@/lib/sdk/supabase/song-cup-submissions";
import { logger } from "@/lib/utils/logger";
import type { SongchainCreatedPost } from "@/lib/songchain/feed-types";
import type { VideoAsset } from "@/lib/types/video-asset";
import type { StreamSummary } from "@/lib/songchain/build-lens-livestream-metadata";

type SongchainComposePostProps = {
  feedId: string | null;
  onPosted?: (created: SongchainCreatedPost) => void;
  /** Pre-fill live stream attach (e.g. from /live page modal). */
  initialLiveStream?: StreamSummary | null;
};

export function SongchainComposePost({
  feedId,
  onPosted,
  initialLiveStream = null,
}: SongchainComposePostProps) {
  const [content, setContent] = useState("");
  const [uploadedVideoAsset, setUploadedVideoAsset] = useState<Partial<VideoAsset> | null>(null);
  const [attachedLiveStream, setAttachedLiveStream] = useState<StreamSummary | null>(
    initialLiveStream?.is_live ? initialLiveStream : null,
  );

  const { createPost, isPosting, canWrite, needsOrbReauth, promptWriteAccess } =
    useSongchainPost();
  const { stream, isLive, loading: streamLoading } = useCreatorLiveStream();
  const { getAuthHeaders, address: authAddress } = useWalletAuth();

  if (!feedId) return null;

  const liveAttached = !!attachedLiveStream?.is_live;
  const canSubmit =
    content.trim().length > 0 || !!uploadedVideoAsset || liveAttached;

  const handleAttachLive = () => {
    if (stream?.is_live) {
      setAttachedLiveStream(stream);
      setUploadedVideoAsset(null);
    }
  };

  const handleUploadVideo = (asset: Partial<VideoAsset>) => {
    setUploadedVideoAsset(asset);
    if (asset) setAttachedLiveStream(null);
  };

  const handleRemoveVideo = () => {
    setUploadedVideoAsset(null);
  };

  const handleSubmit = async () => {
    const created = await createPost({
      content,
      feedId,
      attachedVideo: liveAttached ? null : (uploadedVideoAsset as VideoAsset | null),
      attachedLiveStream: liveAttached ? attachedLiveStream : null,
    });
      if (created) {
      if (uploadedVideoAsset?.location && authAddress) {
        try {
          const authHeaders = await getAuthHeaders();
          const submissionResult = await songCupSubmissionsService.create(
            {
              wallet_address: authAddress,
              grove_url: uploadedVideoAsset.location,
              grove_hash: uploadedVideoAsset.metadata_uri ?? undefined,
              title: uploadedVideoAsset.title ?? undefined,
              description: content.trim() || undefined,
              post_id: created.postId,
            },
            authHeaders,
          );
          if (!submissionResult.ok) {
            if (submissionResult.reason === "error") {
              logger.error(
                "[SongchainComposePost] Song Cup submission failed:",
                submissionResult.message,
              );
            }
          }
        } catch (authErr) {
          logger.error(
            "[SongchainComposePost] Song Cup submission auth failed:",
            authErr,
          );
        }
      }
      setContent("");
      setUploadedVideoAsset(null);
      setAttachedLiveStream(null);
      onPosted?.(created);
    }
  };

  return (
    <section className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Create a post</h3>
      {!canWrite && (
        <p className="text-xs text-muted-foreground">
          {needsOrbReauth
            ? "Your Orb session expired partially — sign in again with Orb to post."
            : "Connect wallet, sign in with Orb, and link your profile to post to this feed."}
        </p>
      )}

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share something with Songchain…"
        rows={3}
        disabled={isPosting}
        maxLength={5000}
      />

      {isLive && !liveAttached && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={streamLoading || isPosting}
          onClick={handleAttachLive}
          className="gap-2 border-red-500/40 text-red-400 hover:text-red-300"
        >
          <Radio className="h-3.5 w-3.5" />
          Attach your live stream
        </Button>
      )}

      {liveAttached && attachedLiveStream && (
        <div className="flex items-center gap-3 rounded-md border border-red-500/30 bg-red-950/20 p-3">
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            LIVE
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {attachedLiveStream.name || "Live on Creative TV"}
            </p>
            <Link
              href={`/watch/${attachedLiveStream.playback_id}`}
              className="text-xs text-violet-400 hover:underline"
            >
              View stream
            </Link>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setAttachedLiveStream(null)}
            aria-label="Detach live stream"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!liveAttached && !uploadedVideoAsset && (
        <GroveVideoUploader
          onUploaded={handleUploadVideo}
          onRemove={handleRemoveVideo}
          uploadedAsset={uploadedVideoAsset}
          disabled={isPosting}
        />
      )}

      {uploadedVideoAsset && (
        <GroveVideoUploader
          onUploaded={handleUploadVideo}
          onRemove={handleRemoveVideo}
          uploadedAsset={uploadedVideoAsset}
          disabled={isPosting}
        />
      )}

      <div className="flex justify-end gap-2">
        {!canWrite ? (
          <Button type="button" variant="outline" size="sm" onClick={promptWriteAccess}>
            {needsOrbReauth ? "Sign in again" : "Link Orb to post"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={isPosting || !canSubmit}
            onClick={() => void handleSubmit()}
          >
            {isPosting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Submit
          </Button>
        )}
      </div>
    </section>
  );
}
