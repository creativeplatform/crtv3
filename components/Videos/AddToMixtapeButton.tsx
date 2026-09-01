"use client";

import { Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddToMixtapeButtonProps {
  /** Video asset UUID (from /discover/{uuid}) */
  assetId: string;
  videoTitle: string;
  playbackId?: string;
  className?: string;
}

/**
 * Available on ALL videos, for ALL users — no license purchase required.
 * Mixtape is a curation/discovery tool for creating playlists, sharing with
 * friends, and broadcasting music.
 *
 * Deep-links to Mixtape (air.creativeplatform.xyz/app) with query params that
 * Mixtape's server can resolve via the existing Platform API partner key.
 */
export function AddToMixtapeButton({
  assetId,
  videoTitle,
  playbackId,
  className = "",
}: AddToMixtapeButtonProps) {
  const mixtapeBaseUrl =
    process.env.NEXT_PUBLIC_MIXTAPE_URL ||
    "https://air.creativeplatform.xyz/app";

  const params = new URLSearchParams({
    add: "video",
    assetId,
    title: videoTitle,
  });
  if (playbackId) {
    params.set("playbackId", playbackId);
  }
  const mixtapeUrl = `${mixtapeBaseUrl}?${params.toString()}`;

  return (
    <Button
      variant="ghost"
      className={`cursor-pointer hover:scale-105 transition-all px-3 py-2 h-auto whitespace-nowrap ${className}`}
      aria-label="Add to Mixtape"
      title="Add this to a Mixtape playlist"
    >
      <a
        href={mixtapeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5"
      >
        <Disc3 className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">Mixtape</span>
      </a>
    </Button>
  );
}