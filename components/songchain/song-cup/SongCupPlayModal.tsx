"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SONG_CUP_PLAY_LINKS } from "@/lib/songchain/events";
import { cn } from "@/lib/utils";

type SongCupPlayModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function PlayCard({
  imageSrc,
  imageAlt,
  headline,
  playLine = "PLAY NOW",
  buttonText,
  href,
}: {
  imageSrc: string;
  imageAlt: string;
  headline: string;
  playLine?: string;
  buttonText: string;
  href: string;
}) {
  return (
    <article className="flex w-full max-w-[280px] flex-col items-center sm:max-w-none">
      <div className="w-full rounded-2xl bg-gradient-to-r from-orange-400 to-yellow-400 p-[2px]">
        <div className="overflow-hidden rounded-2xl bg-black">
          <div
            className="relative mx-auto aspect-square w-full max-w-[min(72vw,240px)] sm:max-w-[220px] md:max-w-[260px]"
          >
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 72vw, 260px"
            />
          </div>
        </div>
      </div>
      <div className="mt-3 flex w-full flex-col items-center gap-0.5 text-center sm:mt-4 sm:gap-1">
        <p
          className="max-w-full text-balance text-[clamp(10px,2.8vw,14px)] font-semibold uppercase leading-snug tracking-wider text-white sm:text-sm"
        >
          {headline}
        </p>
        <p
          className="max-w-full text-balance text-[clamp(10px,2.8vw,14px)] font-semibold uppercase leading-snug tracking-wider text-white sm:text-sm"
        >
          {playLine}
        </p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "mt-3 rounded-full bg-gradient-to-r from-[#E82594] via-fuchsia-500 to-yellow-400",
          "px-8 py-2 text-xs font-black uppercase tracking-widest text-black sm:mt-4 sm:px-10 sm:py-2.5 sm:text-sm",
          "transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400",
        )}
      >
        {buttonText}
      </a>
    </article>
  );
}

export function SongCupPlayModal({ open, onOpenChange }: SongCupPlayModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[110]"
        className={cn(
          "z-[111] w-[calc(100%-1.5rem)] max-w-3xl overflow-hidden border-0 bg-black p-0 shadow-2xl sm:w-full",
          "max-h-[min(92dvh,900px)] overflow-y-auto",
          "[&>button]:z-20 [&>button]:text-white/80 [&>button]:hover:text-white",
        )}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <Image
            src="/songchain/song-cup-play-modal-bg.png"
            alt=""
            fill
            className="object-cover object-center"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>

        <div className="relative z-10 p-4 sm:p-6 md:p-10">
          <DialogHeader className="space-y-1">
            <DialogTitle
              className="text-center text-base font-bold uppercase tracking-wide text-white sm:text-lg"
            >
              Choose how to play
            </DialogTitle>
            <DialogDescription className="sr-only">
              Predict your winner on Orb or guess your artist on Beat Me.
            </DialogDescription>
          </DialogHeader>
          <div
            className="mt-4 grid grid-cols-1 place-items-center gap-8 sm:mt-6 sm:grid-cols-2 sm:place-items-stretch sm:gap-6 md:gap-10"
          >
            <PlayCard
              imageSrc="/songchain/song-cup-predict.png"
              imageAlt="World Cup 2026 — predict your winner"
              headline="PREDICT YOUR WINNER."
              buttonText="GOAL"
              href={SONG_CUP_PLAY_LINKS.goal}
            />
            <PlayCard
              imageSrc="/songchain/BeatMe_v2.png"
              imageAlt="Beat Me — guess your artist"
              headline="GUESS YOUR ARTIST."
              buttonText="BEAT"
              href={SONG_CUP_PLAY_LINKS.beat}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
