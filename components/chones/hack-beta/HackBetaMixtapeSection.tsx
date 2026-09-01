"use client";

import { ExternalLink, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHackBetaSettings } from "@/lib/hooks/hack-beta/useHackBetaSettings";
import { cn } from "@/lib/utils";

type HackBetaMixtapeSectionProps = {
  className?: string;
};

export function HackBetaMixtapeSection({ className }: HackBetaMixtapeSectionProps) {
  const { mixtapePlaylistUrl, isLoading } = useHackBetaSettings();

  if (isLoading) return null;

  if (!mixtapePlaylistUrl) {
    return (
      <section
        className={cn(
          "rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-sm text-muted-foreground",
          className,
        )}
        aria-labelledby="hack-beta-mixtape-heading"
      >
        <h2
          id="hack-beta-mixtape-heading"
          className="flex items-center gap-2 text-base font-semibold text-foreground"
        >
          <Music2 className="h-4 w-4 text-amber-500" />
          Featured mixtape
        </h2>
        <p className="mt-2">
          Admins will publish a Mixtape playlist here once favorites are curated.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-stone-950/30 to-slate-950/40 p-6",
        className,
      )}
      aria-labelledby="hack-beta-mixtape-heading"
    >
      <h2
        id="hack-beta-mixtape-heading"
        className="flex items-center gap-2 text-lg font-bold text-white"
      >
        <Music2 className="h-5 w-5 text-amber-400" />
        Featured mixtape
      </h2>
      <p className="mt-2 text-sm text-amber-50/90">
        Listen to the admin-curated HACKATHON BETA playlist on Mixtape.
      </p>
      <Button asChild className="mt-4 gap-2 bg-amber-400 text-black hover:bg-amber-300">
        <a href={mixtapePlaylistUrl} target="_blank" rel="noopener noreferrer">
          Open playlist
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </section>
  );
}
