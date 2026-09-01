"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { BeatMeBanner } from "@/components/songchain/BeatMeBanner";
import { SongCupBanner } from "@/components/songchain/SongCupBanner";
import { ChonesBanner } from "@/components/chones/ChonesBanner";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 6000;

type ChannelBannersCarouselProps = {
  className?: string;
};

export function ChannelBannersCarousel({ className }: ChannelBannersCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [paused, setPaused] = useState(false);

  const onMouseEnter = useCallback(() => setPaused(true), []);
  const onMouseLeave = useCallback(() => setPaused(false), []);
  const onFocusCapture = useCallback(() => setPaused(true), []);
  const onBlurCapture = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setPaused(false);
    }
  }, []);

  useEffect(() => {
    if (!api || paused) return;
    const id = window.setInterval(() => {
      api.scrollNext();
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [api, paused]);

  return (
    <Carousel
      opts={{ loop: true, align: "start" }}
      setApi={setApi}
      className={cn("w-full", className)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <CarouselContent className="-ml-0">
        <CarouselItem className="pl-0">
          <BeatMeBanner className="h-full" />
        </CarouselItem>
        <CarouselItem className="pl-0">
          <SongCupBanner className="h-full" />
        </CarouselItem>
        <CarouselItem className="pl-0">
          <ChonesBanner
            className="h-full"
            href="/chones/hack-beta"
            buttonLabel="ENTER"
          />
        </CarouselItem>
      </CarouselContent>
      <CarouselPrevious className="left-2 sm:left-4" />
      <CarouselNext className="right-2 sm:right-4" />
    </Carousel>
  );
}
