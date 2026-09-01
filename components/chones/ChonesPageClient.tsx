"use client";

import Link from "next/link";
import Image from "next/image";
import { SongchainOrbConnect } from "@/components/songchain/SongchainOrbConnect";
import { LensRewardsCard } from "@/components/songchain/LensRewardsCard";
import { ChonesBanner } from "@/components/chones/ChonesBanner";
import { ChonesXFollowStrip } from "@/components/chones/ChonesXFollowStrip";
import type { ChonesConfig } from "@/lib/chones/config";
import { CHONES_EVENTS } from "@/lib/chones/events";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type ChonesPageClientProps = {
  config: ChonesConfig;
};

export function ChonesPageClient({ config: _config }: ChonesPageClientProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Chones</span>
      </nav>

      <ChonesBanner className="mb-6" showButton={false} />

      <ChonesXFollowStrip className="mb-10" />

      <div className="mb-10 space-y-6">
        <SongchainOrbConnect />
        <LensRewardsCard />
      </div>

      <section aria-labelledby="chones-events-heading">
        <h2
          id="chones-events-heading"
          className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground"
        >
          <Trophy className="h-5 w-5 text-amber-400" aria-hidden />
          Events
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {CHONES_EVENTS.map((event) => {
            const isActive = event.status === "active";
            const cardContent = (
              <>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  {isActive ? "Live now" : "Coming soon"}
                </span>
                {event.slug === "hack-beta" ? (
                  <div className="mt-2">
                    <Image
                      src="/chones/hack-beta/hackathon-beta-tv-text-outlined.svg"
                      alt="HACKATHON BETA"
                      width={320}
                      height={80}
                      className="h-auto w-[min(70%,280px)]"
                      priority
                      unoptimized
                    />
                  </div>
                ) : (
                  <span className="mt-1 block text-lg font-bold text-white">{event.title}</span>
                )}
                {event.description && (
                  <span className="mt-1 block text-sm text-amber-100/90">{event.description}</span>
                )}
                {isActive && (
                  <span className="mt-3 inline-block rounded-md bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-1.5 text-sm font-semibold text-black">
                    Enter event
                  </span>
                )}
              </>
            );

            if (isActive) {
              return (
                <li key={event.slug}>
                  <Link
                    href={event.href}
                    className={cn(
                      "group relative block min-h-[220px] overflow-hidden rounded-xl border border-amber-500/30 p-6",
                      "transition hover:border-amber-400/50 hover:shadow-md",
                    )}
                  >
                    <div className="absolute inset-0 -z-10" aria-hidden>
                      <Image
                        src="/chones/hack-beta/hackathon-beta-tv-background.svg"
                        alt=""
                        fill
                        className="object-cover object-center opacity-70 transition duration-500 group-hover:opacity-85"
                        sizes="(max-width: 640px) 100vw, 50vw"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/60 to-stone-950/80" />
                    </div>
                    {cardContent}
                  </Link>
                </li>
              );
            }

            return (
              <li key={event.slug}>
                <div
                  className="block cursor-not-allowed rounded-xl border border-amber-500/15 bg-amber-100 p-6 opacity-80"
                  aria-disabled="true"
                >
                  {cardContent}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
