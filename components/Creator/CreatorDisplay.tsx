"use client";

import Link from "next/link";
import { UserDisplay } from "@/components/User/UserDisplay";
import { VideoBuyButton } from "@/components/Videos/VideoBuyButton";

interface CreatorDisplayProps {
  creatorAddress: string;
  className?: string;
  playbackId?: string;
}

export function CreatorDisplay({ creatorAddress, className, playbackId }: CreatorDisplayProps) {
  return (
    <div className={`flex items-center gap-3 ${className || ""}`}>
      <Link
        href={`/creator/${creatorAddress}`}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <UserDisplay
          address={creatorAddress}
          avatarSize="md"
          showAddress={true}
          clickable={false}
          variant="inline"
        />
      </Link>
      {playbackId && (
        <VideoBuyButton
          playbackId={playbackId}
          videoTitle=""
          className="ml-auto"
        />
      )}
    </div>
  );
}

