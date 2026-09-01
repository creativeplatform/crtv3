"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/utils";
import {
  SONG_CUP_BATTLE_STAGE,
  SONG_CUP_CONTEST_REQUIREMENTS,
  SONG_CUP_HERO,
  SONG_CUP_HOW_IT_WORKS,
  SONG_CUP_WHY_PARTICIPATE,
} from "@/lib/songchain/song-cup/copy";
import {
  songCupAccent,
  songCupBody,
  songCupMuted,
  songCupPanel,
} from "@/lib/songchain/song-cup/panel-styles";

type SongCupInfoPanelProps = {
  onGoToSubmit?: () => void;
  className?: string;
};

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className={cn("text-xl font-bold sm:text-2xl", songCupAccent)}>{children}</h2>
  );
}

export function SongCupInfoPanel({ onGoToSubmit, className }: SongCupInfoPanelProps) {
  return (
    <div className={cn("relative overflow-hidden p-4 sm:p-6", songCupPanel, className)}>
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <img
            src="/songchain/button-icons/songcup-icon.svg"
            alt="Song Cup"
            className="h-[120px] w-[120px] object-contain sm:h-[140px] sm:w-[140px]"
          />

          {/* Hero */}
          <section className={cn("space-y-3 text-sm leading-relaxed tracking-[-0.2px] sm:text-base", songCupBody)}>
            <p className={cn("text-2xl font-medium", songCupAccent)}>{SONG_CUP_HERO.headline}</p>
            <p>{SONG_CUP_HERO.intro}</p>
            <p className={songCupMuted}>{SONG_CUP_HERO.collaboration}</p>
          </section>

          {/* How It Works */}
          <section className="space-y-3">
            <SectionHeading>How It Works</SectionHeading>
            <ol className={cn("space-y-3 text-sm sm:text-base", songCupBody)}>
              {SONG_CUP_HOW_IT_WORKS.map((step) => (
                <li key={step.title} className="flex gap-3">
                  <span className={cn("shrink-0 font-bold", songCupAccent)}>{step.title}:</span>
                  <span>
                    {step.title === "Submit" && onGoToSubmit ? (
                      <>
                        Upload your final entry via the{" "}
                        <button
                          type="button"
                          onClick={onGoToSubmit}
                          className={cn(
                            "font-semibold underline hover:text-foreground dark:hover:text-white",
                            songCupAccent,
                          )}
                        >
                          Submission Tab
                        </button>
                        . (No DMs or social media posts will be accepted.)
                      </>
                    ) : (
                      step.body
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* Battle Stage */}
          <section className="space-y-3">
            <SectionHeading>{SONG_CUP_BATTLE_STAGE.title}</SectionHeading>
            {SONG_CUP_BATTLE_STAGE.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className={cn("text-sm sm:text-base", songCupBody)}>
                {paragraph}
              </p>
            ))}
          </section>

          {/* Why Participate */}
          <section className="space-y-3">
            <SectionHeading>{SONG_CUP_WHY_PARTICIPATE.title}</SectionHeading>
            <ul className={cn("space-y-2 text-sm sm:text-base", songCupBody)}>
              {SONG_CUP_WHY_PARTICIPATE.items.map((item) => (
                <li key={item.label}>
                  <span className={cn("font-bold", songCupAccent)}>{item.label}:</span> {item.body}
                </li>
              ))}
            </ul>
          </section>

          {/* Contest Requirements + Terms anchor */}
          <section id="contest-terms" className="scroll-mt-24 space-y-3">
            <SectionHeading>{SONG_CUP_CONTEST_REQUIREMENTS.title}</SectionHeading>
            <ul className={cn("list-disc space-y-2 pl-5 text-sm sm:text-base", songCupBody)}>
              {SONG_CUP_CONTEST_REQUIREMENTS.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex min-w-0 items-start justify-center">
          <div className="relative aspect-square w-full overflow-hidden rounded-[30px]">
            <Image
              src="/songchain/song-cup/song-cup-featured.jpg"
              alt="Song Cup featured visual"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
