"use client";

import { HeartBitProvider } from "@/components/heartbit/HeartBitProvider";
import { HeartBitTipButton } from "@/components/heartbit/HeartBitTipButton";
import { StickerEngagementChips } from "@/components/heartbit/StickerEngagementChips";
import { TipLedgerDrawer } from "@/components/heartbit/TipLedgerDrawer";

type VideoHeartBitSectionProps = {
  videoId: string;
  videoIpfsHash?: string | null;
  creatorAddress?: string | null;
};

/**
 * Hold-to-tip with optional campaign sticker + engagement chips + tip ledger.
 * Scoped HeartBitProvider so the rest of the app stays untouched.
 */
export function VideoHeartBitSection({
  videoId,
  videoIpfsHash,
  creatorAddress,
}: VideoHeartBitSectionProps) {
  if (!creatorAddress) return null;

  return (
    <HeartBitProvider chain="0x2105">
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">Tip</h3>
            <p className="text-xs text-muted-foreground">
              Hold heart · $0.01/s · tip again anytime
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HeartBitTipButton
              videoId={videoId}
              videoIpfsHash={videoIpfsHash}
              creatorAddress={creatorAddress}
            />
            <TipLedgerDrawer videoId={videoId} />
          </div>
        </div>
        <StickerEngagementChips
          videoId={videoId}
          videoIpfsHash={videoIpfsHash}
        />
      </div>
    </HeartBitProvider>
  );
}
