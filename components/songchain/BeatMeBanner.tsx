"use client";

import Image from "next/image";
import { SongCupGoalButton } from "@/components/songchain/song-cup/SongCupGoalButton";
import {
  channelBannerContentClassName,
  channelBannerShell,
} from "@/lib/banners/channel-banner-shell";
import { SONG_CUP_PLAY_LINKS } from "@/lib/songchain/events";
import { cn } from "@/lib/utils";

type BeatMeBannerProps = {
  showButton?: boolean;
  buttonLabel?: string;
  href?: string;
  className?: string;
};

export function BeatMeBanner({
  showButton = true,
  buttonLabel = "PLAY",
  href = SONG_CUP_PLAY_LINKS.beat,
  className,
}: BeatMeBannerProps) {
  return (
    <div className={cn("h-full w-full", className)}>
      {/* Mobile: preserve original 1080/566 aspect with black background and overlaid Play button */}
      <div className={cn(channelBannerShell("bg-black md:hidden"), "aspect-[1080/566] py-0")}>
        <Image
          src="/banners/BEAT_ME_thumbnail.png"
          alt="Beat Me — interactive guess that tune. Beat Me and win USDC."
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
        {showButton ? (
          <div className={cn(channelBannerContentClassName, "justify-end pb-4")}>
            <SongCupGoalButton
              href={href}
              label={buttonLabel}
              className="animate-songcup-pulse hover:animate-none"
            />
          </div>
        ) : null}
      </div>

      {/* Tablet/Desktop: fit shared 1024/274 shell, letterbox on black so the art stays fully visible */}
      <div className={cn(channelBannerShell("bg-black hidden md:block"))}>
        <Image
          src="/banners/BEAT_ME_thumbnail.png"
          alt="Beat Me — interactive guess that tune. Beat Me and win USDC."
          fill
          className="object-contain object-center"
          sizes="(max-width: 1280px) 100vw, 1280px"
          priority
        />
        {showButton ? (
          <div className={cn(channelBannerContentClassName, "justify-end pb-4 lg:pb-6")}>
            <SongCupGoalButton
              href={href}
              label={buttonLabel}
              className="animate-songcup-pulse hover:animate-none"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
