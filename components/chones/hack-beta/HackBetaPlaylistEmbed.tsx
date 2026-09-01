"use client";

import { cn } from "@/lib/utils";

const CHONES_PLAYLIST_URL = "https://air.creativeplatform.xyz/app/s/chones";

type HackBetaPlaylistEmbedProps = {
  className?: string;
};

export function HackBetaPlaylistEmbed({ className }: HackBetaPlaylistEmbedProps) {
  return (
    <section
      aria-labelledby="hack-beta-playlist-heading"
      className={cn("space-y-3", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="hack-beta-playlist-heading"
          className="text-lg font-semibold text-foreground"
        >
          After Party Playlist
        </h2>
        <a
          href={CHONES_PLAYLIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Open playlist
        </a>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <iframe
          title="Chones After Party Playlist"
          src={CHONES_PLAYLIST_URL}
          className="min-h-[480px] w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        />
      </div>
    </section>
  );
}
