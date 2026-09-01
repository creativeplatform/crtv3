"use client";

import Link from "next/link";
import { Film, Loader2, Star } from "lucide-react";
import { HackBetaShareToXButton } from "@/components/chones/hack-beta/HackBetaShareToXButton";
import { HackBetaSubmissionThumbnail } from "@/components/chones/hack-beta/HackBetaSubmissionThumbnail";
import { useHackBetaApprovedSubmissions } from "@/lib/hooks/hack-beta/useHackBetaApprovedSubmissions";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

type HackBetaGalleryProps = {
  className?: string;
};

export function HackBetaGallery({ className }: HackBetaGalleryProps) {
  const { submissions, isLoading, error } = useHackBetaApprovedSubmissions();

  return (
    <section className={cn("space-y-4", className)} aria-labelledby="hack-beta-gallery-heading">
      <div>
        <h2 id="hack-beta-gallery-heading" className="text-xl font-bold text-foreground">
          Demo gallery
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approved HACKATHON BETA submissions. Favorites appear first. Swipe or use the arrows to
          browse.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading gallery…
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!isLoading && !error && submissions.length === 0 && (
        <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          <Film className="mx-auto mb-2 h-8 w-8 opacity-50" />
          No approved demos yet. Submit yours above.
        </div>
      )}

      {!isLoading && !error && submissions.length > 0 && (
        <div className="relative mx-auto w-full">
          <Carousel
            opts={{
              align: "start",
              loop: submissions.length > 3,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-2 md:-ml-3">
              {submissions.map((s) => (
                <CarouselItem
                  key={s.id}
                  className="basis-full pl-2 sm:basis-1/2 md:pl-3 lg:basis-1/3"
                >
                  <article className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
                    <Link href={`/discover/${s.video_asset_id}`} className="block">
                      <HackBetaSubmissionThumbnail
                        playbackId={s.playback_id}
                        thumbnailUrl={s.thumbnail_url}
                        title={s.title}
                        assetId={s.video_asset_id}
                      />
                    </Link>
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-semibold">
                          {s.title || "Untitled demo"}
                        </h3>
                        {s.is_favorite && (
                          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            Favorite
                          </Badge>
                        )}
                      </div>
                      {s.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {s.description}
                        </p>
                      )}
                      <HackBetaShareToXButton title={s.title} size="sm" variant="ghost" />
                    </div>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-0 top-1/2 z-10 -translate-y-1/2 text-[#EC407A] hover:text-[#EC407A]/80 h-10 w-10 sm:h-12 sm:w-12" />
            <CarouselNext className="absolute right-0 top-1/2 z-10 -translate-y-1/2 text-[#EC407A] hover:text-[#EC407A]/80 h-10 w-10 sm:h-12 sm:w-12" />
          </Carousel>
        </div>
      )}
    </section>
  );
}
