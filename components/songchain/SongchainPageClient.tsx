"use client";

import Link from "next/link";
import Image from "next/image";
import { SongchainOrbConnect } from "@/components/songchain/SongchainOrbConnect";
import { SongchainLensAdvancedTooltip } from "@/components/songchain/SongchainLensAdvancedTooltip";
import { LensRewardsCard } from "@/components/songchain/LensRewardsCard";
// import { HallidayOnramp } from "@/components/songchain/HallidayOnramp";
import type { SongchainConfig } from "@/lib/songchain/config";
import { SONGCHAIN_EVENTS } from "@/lib/songchain/events";
import { Music2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type SongchainPageClientProps = {
  config: SongchainConfig;
};

export function SongchainPageClient({ config }: SongchainPageClientProps) {
  return (
    <div className="mx-auto w-full max-w-7xl py-10 px-4 sm:px-6">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Songchain</span>
      </nav>

      <header className="relative mb-10 overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/90 via-fuchsia-950/70 to-slate-950 p-8 sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-300">
            <Music2 className="h-4 w-4" aria-hidden />
            Channel · Lens · Orb
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Songchain
          </h1>
          <p className="mt-3 text-violet-50/95">
            A music channel on Creative TV — join events, explore feeds, and connect
            your Orb account to participate.
          </p>
          <div className="mt-3">
            <SongchainLensAdvancedTooltip />
          </div>
        </div>
      </header>

      <div className="mb-10 space-y-6">
        <SongchainOrbConnect />
        <LensRewardsCard />
        {/* TODO: Re-enable when Halliday supports Lens GHO on production
        <HallidayOnramp
          hallidayApiKey={config.hallidayApiKey}
          hallidayOutputAsset={config.hallidayOutputAsset}
          hallidayInputAssets={config.hallidayInputAssets}
          hallidaySandbox={config.hallidaySandbox}
        />
        */}
      </div>

      <section aria-labelledby="songchain-events-heading">
        <h2
          id="songchain-events-heading"
          className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground"
        >
          <Trophy className="h-5 w-5 text-violet-400" aria-hidden />
          Events
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SONGCHAIN_EVENTS.map((event) => {
            const isActive = event.status === "active";
            const cardContent = (
              <>
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                  {isActive ? "Live now" : "Coming soon"}
                </span>
                {event.slug === "song-cup" ? (
                  <div className="mt-2">
                    <Image
                      src="/songchain/song-cup/logo.svg"
                      alt="Song Cup"
                      width={260}
                      height={44}
                      className="h-auto w-[min(55%,220px)]"
                      priority
                    />
                  </div>
                ) : (
                  <span className="mt-1 block text-lg font-bold text-white">{event.title}</span>
                )}
                {event.description && (
                  <span className="mt-1 block text-sm text-violet-100/90">{event.description}</span>
                )}
                {isActive && (
                  <span className="mt-3 inline-block rounded-md bg-gradient-to-r from-[#E82594] to-[#FF66CC] px-3 py-1.5 text-sm font-semibold text-white">
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
                      "group relative block overflow-hidden rounded-xl border border-violet-500/30 p-6",
                      "transition hover:border-violet-400/50 hover:shadow-md",
                      event.slug === "song-cup" && "min-h-[220px]",
                    )}
                  >
                    {event.slug === "song-cup" && (
                      <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[150%] h-[150%] aspect-square"
                        aria-hidden
                      >
                        <Image
                          src="/songchain/song-cup-banner-charts.png"
                          alt=""
                          fill
                          className="object-cover object-left opacity-60 transition duration-500 group-hover:opacity-75"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-950/90 via-fuchsia-950/70 to-slate-950/80" />
                      </div>
                    )}
                    {event.slug !== "song-cup" && (
                      <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-violet-950/80 to-fuchsia-950/60" aria-hidden />
                    )}
                    {cardContent}
                  </Link>
                </li>
              );
            }

            return (
              <li key={event.slug}>
                <div
                  className="block cursor-not-allowed rounded-xl border border-violet-500/15 bg-violet-100 p-6 opacity-80"
                  aria-disabled="true"
                >
                  {cardContent}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {!config.enabled && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Configure Songchain env vars and redeploy to enable Lens feeds. See{" "}
          <code className="text-xs">env.example</code> in the repo.
        </p>
      )}
    </div>
  );
}
