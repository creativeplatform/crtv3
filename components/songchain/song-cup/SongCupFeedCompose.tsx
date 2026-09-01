"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSongchainPost } from "@/hooks/useSongchainPost";
import type { SongchainCreatedPost } from "@/lib/songchain/feed-types";
import { resolveMediaImageMimeType } from "@/lib/songchain/build-lens-image-metadata";
import { uploadToGrove } from "@/lib/songchain/song-cup/upload-to-grove";
import { cn } from "@/lib/utils/utils";
import {
  songCupBorderAccent,
  songCupMuted,
  songCupPanelInset,
} from "@/lib/songchain/song-cup/panel-styles";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp";

type SongCupFeedComposeProps = {
  feedId: string | null;
  placeholder?: string;
  onPosted?: (created: SongchainCreatedPost) => void;
};

export function SongCupFeedCompose({
  feedId,
  placeholder = "Share something with Songchain…",
  onPosted,
}: SongCupFeedComposeProps) {
  const [content, setContent] = useState("");
  const [focused, setFocused] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const { createPost, isPosting, canWrite, needsOrbReauth, promptWriteAccess } =
    useSongchainPost();

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

  // Native file dialog steals focus; keep compose open until dialog closes.
  useEffect(() => {
    if (!isPickingFile) return;
    const onWindowFocus = () => {
      window.setTimeout(() => setIsPickingFile(false), 300);
    };
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, [isPickingFile]);

  if (!feedId) return null;

  const hasContent = content.trim().length > 0;
  const hasImage = !!imageFile;
  const canSubmit = hasContent || hasImage;
  const busy = isPosting || isUploadingImage;
  const showExpanded = focused || hasContent || hasImage || isPickingFile;

  const clearImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImagePick = (file: File | undefined) => {
    if (!file) return;
    if (!resolveMediaImageMimeType(file.type)) {
      toast.error("Use JPEG, PNG, GIF, or WebP images.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be under 10 MB.");
      return;
    }
    setImageFile(file);
    setFocused(true);
  };

  const handleSubmit = async () => {
    let attachedImage: { url: string; mimeType: string } | null = null;

    if (imageFile) {
      setIsUploadingImage(true);
      try {
        const grove = await uploadToGrove(imageFile);
        attachedImage = {
          url: grove.url,
          mimeType: imageFile.type,
        };
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to upload image to Grove.",
        );
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    const created = await createPost({
      content,
      feedId,
      attachedImage,
    });
    if (created) {
      setContent("");
      clearImage();
      setFocused(false);
      onPosted?.(created);
    }
  };

  const openImagePicker = () => {
    setFocused(true);
    setIsPickingFile(true);
    fileInputRef.current?.click();
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative min-h-[117px] p-4", songCupPanelInset, songCupBorderAccent, "border")}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          handleImagePick(e.target.files?.[0]);
          e.target.value = "";
          setIsPickingFile(false);
        }}
      />

      {!showExpanded ? (
        <button
          type="button"
          onClick={() => setFocused(true)}
          className={cn(
            "flex h-full min-h-[85px] w-full flex-col items-center justify-center gap-2 transition-colors",
            songCupMuted,
            "hover:text-foreground dark:hover:text-white",
          )}
          aria-label="Create a post"
        >
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-full border", songCupBorderAccent)}>
            <Plus className="h-5 w-5" />
          </div>
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {!canWrite && (
            <p className={cn("text-xs", songCupMuted)}>
              {needsOrbReauth
                ? "Your Orb session expired partially — sign in again with Orb to post."
                : "Connect wallet, sign in with Orb, and link your profile to post to this feed."}
            </p>
          )}

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={3}
            disabled={busy}
            maxLength={5000}
            autoFocus={focused}
            onBlur={(e) => {
              if (isPickingFile) return;
              const next = e.relatedTarget as Node | null;
              if (rootRef.current?.contains(next)) return;
              if (!hasContent && !hasImage) setFocused(false);
            }}
            className="border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white dark:placeholder:text-white/40"
          />

          {previewUrl && (
            <div className="relative w-full max-w-xs overflow-hidden rounded-md border border-border/50">
              {/* Local object URL preview only — Grove URL is used on post */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Attachment preview"
                className="max-h-48 w-full object-cover"
              />
              <button
                type="button"
                onClick={clearImage}
                disabled={busy}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 disabled:opacity-50"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!canWrite ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={promptWriteAccess}
              className="w-fit"
            >
              {needsOrbReauth ? "Sign in again" : "Link Orb to post"}
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onMouseDown={(e) => e.preventDefault()}
                onClick={openImagePicker}
                className={cn("gap-1.5 px-2", songCupMuted)}
                aria-label="Attach image"
              >
                <ImageIcon className="h-4 w-4" />
                <span className="text-xs">Image</span>
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || !canSubmit}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handleSubmit()}
                className="rounded-full bg-gradient-to-br from-[#DC2BB3] to-[#FDBE01] px-5 font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isUploadingImage ? "Uploading…" : "POST"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
