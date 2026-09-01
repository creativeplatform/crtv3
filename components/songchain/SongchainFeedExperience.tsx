"use client";

import { useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SongchainOrbConnect } from "@/components/songchain/SongchainOrbConnect";
import { SongchainFeedSection } from "@/components/songchain/SongchainFeedSection";
import { SongchainGroupPanel } from "@/components/songchain/SongchainGroupPanel";
import { SongchainGraphPanel } from "@/components/songchain/SongchainGraphPanel";
import { SongchainComposePost } from "@/components/songchain/SongchainComposePost";
import { SongchainBookmarksSection } from "@/components/songchain/SongchainBookmarksSection";
import { HallidayOnramp } from "@/components/songchain/HallidayOnramp";
import { SongchainGatedFeedTab } from "@/components/songchain/SongchainGatedFeedTab";
import { Season2ExclusiveGatedTab } from "@/components/songchain/season-2/Season2ExclusiveGatedTab";
import type { SongchainConfig } from "@/lib/songchain/config";
import type { SongchainFeedHandle } from "@/components/songchain/SongchainFeedSection";

export type SongchainFeedTab = "feed" | "exclusive" | "group" | "graph" | "bookmarks";

type SongchainFeedExperienceProps = {
  config: SongchainConfig;
  id?: string;
  showWallet?: boolean;
  /** Override public feed id (e.g. Season 2 dedicated feed). */
  publicFeedId?: string | null;
  /** Override exclusive feed id. */
  exclusiveFeedId?: string | null;
  /** Tabs to omit from the experience (e.g. Song Cup hides exclusive). */
  hiddenTabs?: Array<Exclude<SongchainFeedTab, "feed">>;
  publicFeedTitle?: string;
  publicFeedDescription?: string;
  /** Env var names shown in the unconfigured state. */
  configEnvPrefix?: "SONGCHAIN" | "SONG_CUP";
  /** Require Lens group membership before loading or posting to the main feed tab. */
  gateFeedBehindGroup?: boolean;
  /** Group contract used for join / membership checks when gating (defaults to config.groupId). */
  gateGroupId?: string | null;
  clubGateTitle?: string;
  clubGateDescription?: string;
  orbClubUrl?: string;
  /**
   * When set, gate the Exclusive tab behind a valid Unlock key on this lock
   * (Season 2 only — 10 GHO on Lens mainnet).
   */
  exclusiveUnlockLockAddress?: string | null;
};

export function SongchainFeedExperience({
  config,
  id = "songchain-feeds",
  showWallet = true,
  publicFeedId,
  exclusiveFeedId,
  hiddenTabs = [],
  publicFeedTitle = "Songchain feed",
  publicFeedDescription = "Posts from the main Songchain Lens feed (Orb).",
  configEnvPrefix = "SONGCHAIN",
  gateFeedBehindGroup = false,
  gateGroupId,
  clubGateTitle,
  clubGateDescription,
  orbClubUrl,
  exclusiveUnlockLockAddress,
}: SongchainFeedExperienceProps) {
  const publicFeedRef = useRef<SongchainFeedHandle>(null);
  const exclusiveFeedRef = useRef<SongchainFeedHandle>(null);

  const resolvedPublicFeedId = publicFeedId ?? config.publicFeedId;
  const resolvedExclusiveFeedId = exclusiveFeedId ?? config.exclusiveFeedId;
  const hidden = new Set(hiddenTabs);

  const envPrefix =
    configEnvPrefix === "SONG_CUP" ? "SONG_CUP" : "SONGCHAIN";

  if (!config.enabled) {
    return (
      <div id={id} className="scroll-mt-8 space-y-8">
        {showWallet && (
          <div className="space-y-6">
            <SongchainOrbConnect />
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground">
          Configure{" "}
          <code className="text-xs">NEXT_PUBLIC_{envPrefix}_APP_ID</code> (Lens app),{" "}
          <code className="text-xs">NEXT_PUBLIC_{envPrefix}_FEED_ID</code> /{" "}
          <code className="text-xs">NEXT_PUBLIC_{envPrefix}_EXCLUSIVE_FEED_ID</code> (feed
          contracts), and{" "}
          <code className="text-xs">NEXT_PUBLIC_{envPrefix}_GROUP_ID</code>,{" "}
          <code className="text-xs">NEXT_PUBLIC_{envPrefix}_GRAPH_ID</code> with your Lens
          primitives, then redeploy if you added them after the last build. See{" "}
          <code className="text-xs">env.example</code> in the repo.
        </p>
      </div>
    );
  }

  return (
    <div id={id} className="scroll-mt-8 space-y-8">
      {showWallet && (
        <div className="space-y-6">
          <SongchainOrbConnect />
          <HallidayOnramp
            hallidayApiKey={config.hallidayApiKey}
            hallidayOutputAsset={config.hallidayOutputAsset}
            hallidayInputAssets={config.hallidayInputAssets}
            hallidaySandbox={config.hallidaySandbox}
          />
        </div>
      )}

      <Tabs defaultValue="feed" className="space-y-8">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="feed">Feed</TabsTrigger>
          {!hidden.has("exclusive") && (
            <TabsTrigger value="exclusive">Exclusive</TabsTrigger>
          )}
          {!hidden.has("group") && <TabsTrigger value="group">Group</TabsTrigger>}
          {!hidden.has("graph") && <TabsTrigger value="graph">Graph</TabsTrigger>}
          {!hidden.has("bookmarks") && (
            <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="feed" className="space-y-6">
          {gateFeedBehindGroup ? (
            <SongchainGatedFeedTab
              gateGroupId={gateGroupId ?? config.groupId}
              feedId={resolvedPublicFeedId}
              graphId={config.graphId}
              feedTitle={publicFeedTitle}
              feedDescription={publicFeedDescription}
              clubGateTitle={clubGateTitle}
              clubGateDescription={clubGateDescription}
              orbClubUrl={orbClubUrl}
            />
          ) : (
            <>
              <SongchainComposePost
                feedId={resolvedPublicFeedId}
                onPosted={(created) => publicFeedRef.current?.registerNewPost(created)}
              />
              <SongchainFeedSection
                ref={publicFeedRef}
                title={publicFeedTitle}
                description={publicFeedDescription}
                feedId={resolvedPublicFeedId}
                graphId={config.graphId}
                onPostUpdated={() => publicFeedRef.current?.reload()}
                emptyDescription="Lens custom feeds only show posts published to that feed contract. Existing Orb profile or global posts are not backfilled, so publish a new post directly to this feed if it should appear here."
              />
            </>
          )}
        </TabsContent>

        {!hidden.has("exclusive") && (
          <TabsContent value="exclusive" className="space-y-6">
            {exclusiveUnlockLockAddress ? (
              <Season2ExclusiveGatedTab
                lockAddress={exclusiveUnlockLockAddress}
                feedId={resolvedExclusiveFeedId}
                graphId={config.graphId}
              />
            ) : (
              <>
                <SongchainComposePost
                  feedId={resolvedExclusiveFeedId}
                  onPosted={(created) => exclusiveFeedRef.current?.registerNewPost(created)}
                />
                <SongchainFeedSection
                  ref={exclusiveFeedRef}
                  title="Exclusive feed"
                  description="Members-only drops and announcements on Lens."
                  feedId={resolvedExclusiveFeedId}
                  graphId={config.graphId}
                  onPostUpdated={() => exclusiveFeedRef.current?.reload()}
                  emptyDescription="Exclusive feeds can require an Orb-linked Lens session, and posts still need to be published directly to the exclusive feed contract before they appear here."
                />
              </>
            )}
          </TabsContent>
        )}

        {!hidden.has("group") && (
          <TabsContent value="group">
            <SongchainGroupPanel groupId={config.groupId} />
          </TabsContent>
        )}

        {!hidden.has("graph") && (
          <TabsContent value="graph">
            <SongchainGraphPanel graphId={config.graphId} groupId={config.groupId} />
          </TabsContent>
        )}

        {!hidden.has("bookmarks") && (
          <TabsContent value="bookmarks">
            <SongchainBookmarksSection graphId={config.graphId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
