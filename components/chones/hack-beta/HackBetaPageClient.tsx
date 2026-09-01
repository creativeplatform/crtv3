"use client";

import Link from "next/link";
import { SongchainOrbConnect } from "@/components/songchain/SongchainOrbConnect";
import { SongCupFeedPanel } from "@/components/songchain/song-cup/SongCupFeedPanel";
import { ChonesXFollowStrip } from "@/components/chones/ChonesXFollowStrip";
import { HackBetaHero } from "./HackBetaHero";
// import { HackBetaMixtapeSection } from "./HackBetaMixtapeSection";
import { HackBetaPlaylistEmbed } from "./HackBetaPlaylistEmbed";
import { HackBetaSubmitPanel } from "./HackBetaSubmitPanel";
import { HackBetaGallery } from "./HackBetaGallery";
import { useHackBetaAdmin } from "@/lib/hooks/hack-beta/useHackBetaAdmin";
import type { ChonesConfig } from "@/lib/chones/config";
import { Button } from "@/components/ui/button";

type HackBetaPageClientProps = {
  config: ChonesConfig;
};

export function HackBetaPageClient({ config }: HackBetaPageClientProps) {
  const { isAdmin } = useHackBetaAdmin();

  return (
    <div className="w-full">
      <nav className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-muted-foreground sm:px-6">
        <div>
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/chones" className="hover:text-foreground">
            Chones
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">HACKATHON BETA</span>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/chones/hack-beta/submissions">Admin submissions</Link>
          </Button>
        )}
      </nav>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <HackBetaHero className="mb-8" />
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 pb-12 sm:px-6">
        <ChonesXFollowStrip />
        <SongchainOrbConnect />
        <div id="hack-beta-submit" className="scroll-mt-8">
          <HackBetaSubmitPanel />
        </div>
        <HackBetaGallery />
        <HackBetaPlaylistEmbed />

        <div id="hack-beta-feed" className="scroll-mt-8">
          {config.enabled ? (
            <SongCupFeedPanel
              feedId={config.publicFeedId}
              groupId={config.groupId}
              graphId={config.graphId}
              feedTitle="HACKATHON BETA feed"
              feedDescription="Member-only posts — join the club on Orb to read and post on the hackathon feed."
              placeholder="Share something with Chones…"
              orbClubUrl={
                config.groupId
                  ? `https://orb.club/c/${config.groupId}`
                  : undefined
              }
              clubLogoUrl="/chones/chonesbannerblackyellowlogo.svg"
              clubLabel="HACKATHON BETA"
            />
          ) : (
            <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Lens feed not configured yet</p>
              <p className="mt-2">
                Set{" "}
                <code className="text-xs">NEXT_PUBLIC_HACK_BETA_APP_ID</code>,{" "}
                <code className="text-xs">NEXT_PUBLIC_HACK_BETA_FEED_ID</code>,{" "}
                <code className="text-xs">NEXT_PUBLIC_HACK_BETA_GROUP_ID</code>, and{" "}
                <code className="text-xs">NEXT_PUBLIC_HACK_BETA_GRAPH_ID</code> in your
                environment, then redeploy.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
