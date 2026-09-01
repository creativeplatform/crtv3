"use client";

import { Badge } from '@/components/ui/badge';
import { resolveHubAsset, type HubAssetConfig } from '@/lib/utils/hubAssetUtils';
import { cn } from '@/lib/utils';

interface CollateralBadgeProps {
  hubId: number;
  assetAddress?: string;
  className?: string;
  showHubId?: boolean;
}

export function CollateralBadge({
  hubId,
  assetAddress,
  className,
  showHubId = false,
}: CollateralBadgeProps) {
  const asset = resolveHubAsset(hubId, assetAddress);
  const label = showHubId
    ? `Hub ${hubId} · ${asset.displayName}`
    : asset.displayName;

  return (
    <Badge
      variant={asset.deprecated ? 'outline' : asset.recommended ? 'default' : 'secondary'}
      className={cn(
        'text-xs font-normal',
        asset.deprecated && 'border-amber-500/50 text-amber-700 dark:text-amber-400',
        asset.recommended && 'bg-emerald-600 hover:bg-emerald-600',
        className
      )}
      title={asset.description}
    >
      {label}
      {asset.recommended && !showHubId ? ' · Recommended' : null}
      {asset.deprecated ? ' · Legacy' : null}
    </Badge>
  );
}

export function CollateralBackingText({
  hubId,
  assetAddress,
  className,
}: {
  hubId: number;
  assetAddress?: string;
  className?: string;
}) {
  const asset = resolveHubAsset(hubId, assetAddress);
  return (
    <span className={cn('text-muted-foreground', className)} title={asset.description}>
      Collateral: <strong className="text-foreground">{asset.displayName}</strong>
    </span>
  );
}

export function getCollateralConfig(hubId: number, assetAddress?: string): HubAssetConfig {
  return resolveHubAsset(hubId, assetAddress);
}
