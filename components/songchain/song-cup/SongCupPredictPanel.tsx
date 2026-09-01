"use client";

import Link from "next/link";
import { CreatePrediction } from "@/components/predictions/CreatePrediction";
import { Button } from "@/components/ui/button";
import { songCupMuted } from "@/lib/songchain/song-cup/panel-styles";
import { cn } from "@/lib/utils/utils";
import {
  SongCupPredictContentWell,
  SongCupPredictGradientGlow,
  SongCupPredictTitle,
} from "./predict/SongCupPredictUi";
import { SONG_CUP_PREDICT_ASSETS } from "@/lib/songchain/song-cup/predict-design";

type SongCupPredictPanelProps = {
  className?: string;
};

export function SongCupPredictPanel({ className }: SongCupPredictPanelProps) {
  return (
    <SongCupPredictContentWell className={className}>
      <SongCupPredictGradientGlow className="-left-20 top-0 h-[275px] w-[353px] sm:h-[413px] sm:w-[529px]" />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <img
              src={SONG_CUP_PREDICT_ASSETS.predictIcon}
              alt=""
              aria-hidden
              className="hidden h-[120px] w-[120px] object-contain lg:block"
            />
            <div className="flex min-w-0 flex-col gap-2">
              <SongCupPredictTitle />
              <p className={cn("max-w-md text-sm", songCupMuted)}>
                Create a market for the cup — then browse open predictions to
                place your bond.
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-fit shrink-0 border-white/20 bg-white/5 text-foreground hover:bg-white/10 dark:text-white"
          >
            <Link href="/predict">Browse markets</Link>
          </Button>
        </div>

        <CreatePrediction
          embedded
          defaultCategory="music"
          successHref="/predict"
        />
      </div>
    </SongCupPredictContentWell>
  );
}
