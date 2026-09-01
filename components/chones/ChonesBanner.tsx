"use client";

import Image from "next/image";
import { SongCupGoalButton } from "@/components/songchain/song-cup/SongCupGoalButton";
import {
  channelBannerContentClassName,
  channelBannerShell,
} from "@/lib/banners/channel-banner-shell";
import { cn } from "@/lib/utils";

type ChonesBannerProps = {
  showButton?: boolean;
  buttonLabel?: string;
  href?: string;
  className?: string;
};

export function ChonesBanner({
  showButton = true,
  buttonLabel = "ENTER",
  href = "/chones",
  className,
}: ChonesBannerProps) {
  return (
    <div className={cn("h-full w-full", className)}>
      {/* Mobile: original cream logo — scales better on phones (incl. landscape) */}
      <div
        className={channelBannerShell(
          "chones-banner-mobile bg-[#f0e6da] md:hidden",
        )}
      >
        <div className={channelBannerContentClassName}>
          <div className="relative aspect-[1024/173] w-[min(78vw,720px)] max-w-full">
            <Image
              src="/chones/chones-banner.png"
              alt="Chones"
              fill
              className="object-contain object-center"
              priority
              sizes="78vw"
            />
          </div>

          {showButton ? (
            <SongCupGoalButton
              href={href}
              label={buttonLabel}
              className="animate-songcup-pulse hover:animate-none"
            />
          ) : (
            /* Keep vertical rhythm when ENTER is hidden (e.g. /chones page) */
            <span
              className="invisible inline-flex w-[clamp(120px,38vw,330px)]"
              aria-hidden
            >
              <span className="aspect-[296/129] w-full" />
            </span>
          )}
        </div>
      </div>

      {/* Tablet/Desktop: full-bleed creative SVG */}
      <div
        className={channelBannerShell(
          "chones-banner-desktop hidden aspect-[1024/274] bg-[#f0e6da] py-0 md:block",
        )}
      >
        <Image
          src="/chones/chonescreativechannelbanner.svg"
          alt="Chones"
          fill
          className="object-cover object-center"
          priority
          unoptimized
          sizes="(max-width: 1280px) 100vw, 1280px"
        />

        {showButton ? (
          <div
            className={cn(
              channelBannerContentClassName,
              "justify-end pb-4 lg:pb-6",
            )}
          >
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
