"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, Loader2, Film, AlertCircle, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadToGrove } from "@/lib/songchain/song-cup/upload-to-grove";
import type { VideoAsset } from "@/lib/types/video-asset";

const MAX_VIDEO_SIZE_MB = 1024; // 1 GB ceiling for browser sanity
const ACCEPTED_VIDEO_TYPES = "video/*";

export type GroveVideoUploadResult = {
  url: string;
  hash: string;
  name: string;
  size: number;
  type: string;
};

type GroveVideoUploaderProps = {
  onUploaded: (asset: Partial<VideoAsset>) => void;
  onRemove: () => void;
  uploadedAsset: Partial<VideoAsset> | null;
  disabled?: boolean;
};

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function GroveVideoUploader({
  onUploaded,
  onRemove,
  uploadedAsset,
  disabled,
}: GroveVideoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setError(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file.");
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setError(`Video must be under ${MAX_VIDEO_SIZE_MB} MB.`);
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await uploadToGrove(file);
      onUploaded({
        title: file.name,
        location: result.url,
        thumbnailUri: result.url,
        metadata_uri: result.hash ?? result.url,
        duration: null,
        status: "draft",
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setProgress(0);
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  };

  if (uploadedAsset) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border/50 bg-muted/20 p-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-muted">
          <Film className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{uploadedAsset.title}</p>
          <p className="text-xs text-muted-foreground">
            Uploaded to Grove
          </p>
          {uploadedAsset.location && (
            <a
              href={uploadedAsset.location}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-xs text-violet-400 hover:underline"
            >
              View on IPFS
            </a>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label="Remove uploaded video"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES}
        disabled={disabled || isUploading}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />
      <button
        type="button"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 transition-colors",
          "text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging
            ? "border-violet-500 bg-violet-500/10"
            : "border-border/70 bg-muted/20 hover:border-violet-400/60 hover:bg-muted/30",
          (disabled || isUploading) && "pointer-events-none opacity-60",
        ].join(" ")}
      >
        {isUploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        ) : (
          <FileVideo className="h-6 w-6 text-muted-foreground" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium">
            {isUploading ? "Uploading to Grove…" : "Drag & drop a video, or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground">
            Submit a raw video directly to Grove storage.
          </p>
        </div>
      </button>

      {isUploading && progress > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-violet-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
