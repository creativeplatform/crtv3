import { erc20Abi, type Address } from 'viem';
import { METOKEN_DIAMOND_BASE } from '@/lib/contracts/metokens/deployments';
import {
  getHubAssetByAddress,
  getHubAssetByHubId,
  type HubAssetConfig,
} from '@/lib/contracts/MeTokenHubs';
import { publicClient } from '@/lib/viem';

const DIAMOND = METOKEN_DIAMOND_BASE;

const HUB_INFO_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'getHubInfo',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'startTime', type: 'uint256' },
          { internalType: 'uint256', name: 'endTime', type: 'uint256' },
          { internalType: 'uint256', name: 'endCooldown', type: 'uint256' },
          { internalType: 'uint256', name: 'refundRatio', type: 'uint256' },
          { internalType: 'uint256', name: 'targetRefundRatio', type: 'uint256' },
          { internalType: 'address', name: 'owner', type: 'address' },
          { internalType: 'address', name: 'vault', type: 'address' },
          { internalType: 'address', name: 'asset', type: 'address' },
          { internalType: 'bool', name: 'updating', type: 'bool' },
          { internalType: 'bool', name: 'reconfigure', type: 'bool' },
          { internalType: 'bool', name: 'active', type: 'bool' },
        ],
        internalType: 'struct LibHub.HubInfo',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/** Collateral resolved from on-chain hub state (not static config fallback). */
export type HubCollateralConfig = {
  address: `0x${string}`;
  decimals: number;
  hubId: number;
  symbol: string;
  displayName: string;
};

export type HubCreationContext = {
  collateral: HubCollateralConfig;
  vault: Address;
  active: boolean;
};

function hubInfoToCollateral(
  hubId: number,
  assetAddress: `0x${string}`
): HubCollateralConfig {
  const known =
    getHubAssetByAddress(assetAddress) ?? getHubAssetByHubId(hubId);

  if (known) {
    return {
      address: known.address,
      decimals: known.decimals,
      hubId,
      symbol: known.symbol,
      displayName: known.displayName,
    };
  }

  return {
    address: assetAddress,
    decimals: 18,
    hubId,
    symbol: `HUB${hubId}`,
    displayName: `Hub ${hubId} collateral`,
  };
}

/**
 * Load hub vault, collateral asset, and decimals from the Diamond contract.
 * Avoids static HUB_ASSET_CONFIGS fallback when hub IDs diverge from config.
 */
export async function fetchHubCreationContext(hubId: number): Promise<HubCreationContext> {
  const hubInfo = await publicClient.readContract({
    address: DIAMOND,
    abi: HUB_INFO_ABI,
    functionName: 'getHubInfo',
    args: [BigInt(hubId)],
  });

  const assetAddress = hubInfo.asset as `0x${string}`;
  const vault = hubInfo.vault as Address;

  if (!assetAddress || assetAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error(`Hub ${hubId} has no collateral asset registered on-chain.`);
  }

  if (!vault || vault === '0x0000000000000000000000000000000000000000') {
    throw new Error(`Hub ${hubId} has no vault registered on-chain.`);
  }

  let collateral = hubInfoToCollateral(hubId, assetAddress);

  const known = getHubAssetByAddress(assetAddress) ?? getHubAssetByHubId(hubId);
  if (!known) {
    const decimals = await publicClient.readContract({
      address: assetAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    });
    collateral = { ...collateral, decimals: Number(decimals) };
  }

  return {
    collateral,
    vault,
    active: hubInfo.active,
  };
}

/** Narrow on-chain collateral to HubAssetConfig when statically known. */
export function asHubAssetConfig(collateral: HubCollateralConfig): HubAssetConfig | null {
  return getHubAssetByAddress(collateral.address) ?? getHubAssetByHubId(collateral.hubId);
}
