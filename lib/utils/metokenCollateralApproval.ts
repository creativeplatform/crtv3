import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { getHubVaultAddress } from '@/lib/utils/metokenSubscriptionUtils';
import { resolveHubAsset, formatHubAssetAmount, parseHubAssetAmount } from '@/lib/utils/hubAssetUtils';
import type { HubAssetConfig } from '@/lib/utils/hubAssetUtils';

export function getCollateralForHub(hubId: number): HubAssetConfig {
  return resolveHubAsset(hubId);
}

export function parseCollateralAmount(amount: string, hubId: number): bigint {
  return parseHubAssetAmount(amount, resolveHubAsset(hubId));
}

export function formatCollateralAmount(amount: bigint, hubId: number): string {
  return formatHubAssetAmount(amount, resolveHubAsset(hubId));
}

export function getCollateralErc20Abi() {
  return erc20Abi;
}

export async function getVaultForHub(hubId: number): Promise<string> {
  return getHubVaultAddress(hubId);
}

export function collateralSymbol(hubId: number): string {
  return resolveHubAsset(hubId).symbol;
}

/** Format human-readable collateral for error messages. */
export function describeCollateralAmount(amount: bigint, hubId: number): string {
  const asset = resolveHubAsset(hubId);
  return `${formatUnits(amount, asset.decimals)} ${asset.symbol}`;
}
