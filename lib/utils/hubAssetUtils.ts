import { formatUnits, parseUnits } from 'viem';
import {
  getHubAssetByAddress,
  getHubAssetByHubId,
  type HubAssetConfig,
  type HubAssetSymbol,
  HUB_ASSET_CONFIGS,
  DEFAULT_HUB_ASSET,
  formatMeTokenBackingLabel,
} from '@/lib/contracts/MeTokenHubs';
import type { HubCollateralConfig } from '@/lib/metokens/hub-onchain';

export type { HubAssetConfig, HubAssetSymbol };

type AmountAsset = HubAssetConfig | string | HubCollateralConfig;

function resolveDecimals(asset: AmountAsset): number {
  if (typeof asset === 'string') {
    return (getHubAssetByAddress(asset) ?? HUB_ASSET_CONFIGS[DEFAULT_HUB_ASSET]).decimals;
  }
  return asset.decimals;
}

export function parseHubAssetAmount(amount: string, asset: AmountAsset): bigint {
  return parseUnits(amount || '0', resolveDecimals(asset));
}

export function formatHubAssetAmount(amount: bigint, asset: AmountAsset): string {
  return formatUnits(amount, resolveDecimals(asset));
}

/**
 * Vault TVL in USD-stable units from pooled+locked collateral.
 * Hub collateral decimals differ: USDC = 6; DAI / USDS / GHO = 18.
 * (MeToken ERC-20 balances themselves are always 18 decimals.)
 */
export function calculateMeTokenVaultTvlUsd(
  balancePooled: bigint | number | string = 0,
  balanceLocked: bigint | number | string = 0,
  hubId?: number,
  assetAddress?: string
): number {
  const pooled = BigInt(balancePooled ?? 0);
  const locked = BigInt(balanceLocked ?? 0);
  const asset = resolveHubAsset(hubId, assetAddress);
  return Number(formatHubAssetAmount(pooled + locked, asset));
}

export function resolveHubAsset(hubId?: number, assetAddress?: string): HubAssetConfig {
  if (assetAddress) {
    const byAddress = getHubAssetByAddress(assetAddress);
    if (byAddress) return byAddress;
  }
  if (hubId != null && Number.isFinite(hubId) && hubId > 0) {
    const byHub = getHubAssetByHubId(hubId);
    if (byHub) return byHub;
  }
  return HUB_ASSET_CONFIGS[DEFAULT_HUB_ASSET];
}

export function collateralLabel(config: HubAssetConfig): string {
  return config.displayName;
}

export function getMeTokenBackingLabel(hubId: number): string {
  return formatMeTokenBackingLabel(hubId);
}
