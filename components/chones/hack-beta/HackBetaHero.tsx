"use client";

import Image from "next/image";
import { SongCupGoalButton } from "@/components/songchain/song-cup/SongCupGoalButton";
import { cn } from "@/lib/utils";

type HackBetaHeroProps = {
  className?: string;
};

export function HackBetaHero({ className }: HackBetaHeroProps) {
  const scrollToSubmit = () => {
    const element = document.getElementById("hack-beta-submit");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      return;
    }
    document.getElementById("hack-beta-feed")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className={cn(
        "relative mx-auto min-h-[220px] w-full max-w-7xl overflow-hidden rounded-xl bg-[#f0e6da]",
        "lg:aspect-[1024/274]",
        className,
      )}
    >
      <Image
        src="/chones/hack-beta/hackathonbetacreativebanner.svg"
        alt="Chones HACKATHON BETA — July 20–24, 2026 Virtual"
        fill
        className="object-cover object-center"
        priority
        unoptimized
        sizes="(max-width: 1280px) 100vw, 1280px"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 bg-gradient-to-t from-black/50 via-transparent to-transparent px-4 pb-6 sm:pb-8">
        <p className="text-center text-sm font-medium text-white/90 sm:text-base">
          July 20–24, 2026 · Virtual
        </p>
        <SongCupGoalButton
          label="Submit"
          onClick={scrollToSubmit}
          className="animate-songcup-pulse hover:animate-none"
        />
      </div>
    </section>
  );
}
