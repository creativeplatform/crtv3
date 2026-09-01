"use client";

import { Alert, AlertDescription } from '@/components/ui/alert';
import { CollateralBadge } from '@/components/metokens/CollateralBadge';
import { getHubAssetByHubId, getHubAssetBySymbol, type HubAssetSymbol } from '@/lib/contracts/MeTokenHubs';
import type { MeTokenHubInfo } from '@/lib/hooks/metokens/useMeTokenHubs';
import { Info } from 'lucide-react';

interface CollateralHubGuideProps {
  hub: MeTokenHubInfo | null;
  className?: string;
}

function getConfig(hub: MeTokenHubInfo | null) {
  if (!hub) return getHubAssetBySymbol('USDC');
  if (hub.symbol !== 'UNKNOWN') {
    return getHubAssetBySymbol(hub.symbol);
  }
  return getHubAssetByHubId(hub.hubId) ?? getHubAssetBySymbol('USDC');
}

export function CollateralHubGuide({ hub, className }: CollateralHubGuideProps) {
  if (!hub) return null;

  const config = getConfig(hub);

  return (
    <Alert className={className}>
      <Info className="h-4 w-4" />
      <AlertDescription className="space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Your MeToken will be backed by:</span>
          <CollateralBadge hubId={hub.hubId} showHubId />
        </div>
        <p className="text-muted-foreground">{config.tagline}</p>
        <p>
          <span className="font-medium text-foreground">Best for: </span>
          {config.bestFor}
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium">Tradeoff: </span>
          {config.tradeoff}
        </p>
      </AlertDescription>
    </Alert>
  );
}

/** Short comparison shown below the hub selector. */
export const STABLECOIN_SUMMARY: Record<Exclude<HubAssetSymbol, 'DAI'>, string> = {
  USDC: 'Recommended — widest acceptance, easiest onboarding and payouts.',
  USDS: 'Decentralized DAI successor — great for savings-oriented communities.',
  GHO: 'DeFi-focused — lending and borrowing power users.',
};
