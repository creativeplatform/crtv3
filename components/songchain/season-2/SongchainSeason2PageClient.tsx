"use client";

import Link from "next/link";
import { useState } from "react";
import type { SongchainConfig } from "@/lib/songchain/config";
import { SongCupBanner } from "@/components/songchain/SongCupBanner";
import { SongchainFeedExperience } from "@/components/songchain/SongchainFeedExperience";
import { SongCupHero } from "@/components/songchain/song-cup/SongCupHero";
import { SongCupPlayModal } from "@/components/songchain/song-cup/SongCupPlayModal";

type SongchainSeason2PageClientProps = {
  config: SongchainConfig;
};

export function SongchainSeason2PageClient({
  config,
}: SongchainSeason2PageClientProps) {
  const [playModalOpen, setPlayModalOpen] = useState(false);

  const publicFeedId = config.season2PublicFeedId ?? config.publicFeedId;
  const exclusiveFeedId =
    config.season2ExclusiveFeedId ?? config.exclusiveFeedId;

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
        <span className="text-foreground">Season 2</span>
      </nav>

      <SongCupHero
        ariaLabel="Songchain Season 2"
        headline="BE OUR TOP ARTIST"
        subheadline="Create your 30 sec. World Cup music video"
        ctaLabel="Let's Goal"
        animationPaused={playModalOpen}
        onCtaClick={() => setPlayModalOpen(true)}
      />
      <SongCupPlayModal open={playModalOpen} onOpenChange={setPlayModalOpen} />

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
        <SongCupBanner showButton={false} />
        <SongchainFeedExperience
          config={config}
          id="songchain-season-2-feeds"
          publicFeedId={publicFeedId}
          exclusiveFeedId={exclusiveFeedId}
          exclusiveUnlockLockAddress={config.season2LockAddress}
        />
      </div>
    </div>
  );
}
