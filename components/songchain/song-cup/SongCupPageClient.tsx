"use client";

import Link from "next/link";
import { useState } from "react";
import type { SongchainConfig } from "@/lib/songchain/config";
import { SongCupBottomSection } from "@/components/songchain/song-cup/SongCupBottomSection";
import { SongCupBrandLogo } from "@/components/songchain/song-cup/SongCupBrandLogo";
import { SongCupHero } from "@/components/songchain/song-cup/SongCupHero";
import { SongCupPlayModal } from "@/components/songchain/song-cup/SongCupPlayModal";
import { SONG_CUP_PLAY_LINKS } from "@/lib/songchain/events";

type SongCupPageClientProps = {
  config: SongchainConfig;
};

export function SongCupPageClient({ config }: SongCupPageClientProps) {
  const [playModalOpen, setPlayModalOpen] = useState(false);

  return (
    <div className="w-full">
      <nav className="mx-auto mb-0 max-w-7xl px-4 py-4 text-sm text-muted-foreground sm:px-6">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/songchain" className="hover:text-foreground">
          Songchain
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Song Cup</span>
      </nav>

      <SongCupHero
        logo={<SongCupBrandLogo priority />}
        headline=""
        subheadline=""
        ctaLabel="Play"
        ariaLabel="Song Cup"
        animationPaused={playModalOpen}
        onCtaClick={() => setPlayModalOpen(true)}
      />
      <SongCupPlayModal open={playModalOpen} onOpenChange={setPlayModalOpen} />

      <SongCupBottomSection
        config={config}
        feedId={config.publicFeedId}
        groupId={config.groupId}
        graphId={config.graphId}
        clubGateTitle="Join the Song Cup club to unlock the feed"
        clubGateDescription="Join the Song Cup club on Lens (via Orb) to read and post on the member-only feed."
        orbClubUrl={SONG_CUP_PLAY_LINKS.club}
        publicFeedTitle="Song Cup club feed"
        publicFeedDescription="Member-only posts — available after you join the club."
      />
    </div>
  );
}
