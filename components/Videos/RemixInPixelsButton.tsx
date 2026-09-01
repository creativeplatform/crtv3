"use client";

import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RemixInPixelsButtonProps {
  className?: string;
}

/**
 * Shows on IP-registered videos that have a derivatives-allowed license.
 * Links to Creative Pixels (create.creativeplatform.xyz) so viewers can
 * remix/edit the video after purchasing a license.
 */
export function RemixInPixelsButton({ className = "" }: RemixInPixelsButtonProps) {
  const creativePixelsUrl =
    process.env.NEXT_PUBLIC_CREATIVE_PIXELS_URL ||
    "https://create.creativeplatform.xyz";

  return (
    <Button
      variant="ghost"
      className={`cursor-pointer hover:scale-105 transition-all px-3 py-2 h-auto whitespace-nowrap ${className}`}
      aria-label="Remix in Creative Pixels"
      title="Edit this video in Creative Pixels"
    >
      <a
        href={creativePixelsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5"
      >
        <Scissors className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">Remix</span>
      </a>
    </Button>
  );
}