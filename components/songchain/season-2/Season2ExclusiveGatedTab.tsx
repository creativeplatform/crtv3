"use client";

import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { SongchainComposePost } from "@/components/songchain/SongchainComposePost";
import {
  SongchainFeedSection,
  type SongchainFeedHandle,
} from "@/components/songchain/SongchainFeedSection";
import { Season2UnlockPurchase } from "@/components/songchain/season-2/Season2UnlockPurchase";
import { useSeason2UnlockKey } from "@/hooks/useSeason2UnlockKey";

type Season2ExclusiveGatedTabProps = {
  lockAddress: string;
  feedId: string | null;
  graphId: string | null;
};

export function Season2ExclusiveGatedTab({
  lockAddress,
  feedId,
  graphId,
}: Season2ExclusiveGatedTabProps) {
  const exclusiveFeedRef = useRef<SongchainFeedHandle>(null);
  const { hasValidKey, isLoading, refetch } = useSeason2UnlockKey({
    lockAddress,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center rounded-lg border border-border/60 bg-card py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasValidKey) {
    return (
      <Season2UnlockPurchase
        lockAddress={lockAddress}
        onPurchaseSuccess={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SongchainComposePost
        feedId={feedId}
        onPosted={(created) => exclusiveFeedRef.current?.registerNewPost(created)}
      />
      <SongchainFeedSection
        ref={exclusiveFeedRef}
        title="Exclusive feed"
        description="Season 2 members-only drops and announcements on Lens."
        feedId={feedId}
        graphId={graphId}
        onPostUpdated={() => exclusiveFeedRef.current?.reload()}
        emptyDescription="Exclusive feeds can require an Orb-linked Lens session, and posts still need to be published directly to the exclusive feed contract before they appear here."
      />
    </div>
  );
}
