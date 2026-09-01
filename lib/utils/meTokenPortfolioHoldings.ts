import { formatEther } from "viem";
import type { MeTokenHolding } from "@/lib/hooks/metokens/useMeTokenHoldings";
import type { MeTokenData } from "@/lib/hooks/metokens/useMeTokensSupabase";
import { estimateMeTokenHoldingValueUsd } from "@/lib/utils/meTokenHoldingValue";
import { resolveHubAsset } from "@/lib/utils/hubAssetUtils";

/**
 * Build a MeTokenHolding from the creator's own MeToken when it is missing
 * from indexed holdings (subgraph lag, SCA vs EOA owner mismatch, etc.).
 */
export function buildOwnHoldingFallback(
  userMeToken: MeTokenData,
  ownerAddress: string
): MeTokenHolding {
  const balanceRaw =
    typeof userMeToken.balance === "bigint" ? userMeToken.balance : BigInt(0);
  const totalSupply =
    typeof userMeToken.totalSupply === "bigint" ? userMeToken.totalSupply : BigInt(0);
  const collateral = resolveHubAsset(userMeToken.hubId);
  const vaultTvlUsd = userMeToken.tvl || 0;
  const holdingValueUsd = estimateMeTokenHoldingValueUsd({
    balanceRaw,
    totalSupply,
    vaultTvlUsd,
  });

  return {
    address: userMeToken.address,
    name: userMeToken.name,
    symbol: userMeToken.symbol,
    balance: formatEther(balanceRaw),
    balanceRaw,
    totalSupply,
    tvl: vaultTvlUsd,
    holdingValueUsd,
    creatorProfile: null,
    ownerAddress: ownerAddress || userMeToken.owner || "",
    isOwnMeToken: true,
    hubId: userMeToken.hubId || 0,
    balancePooled: userMeToken.balancePooled || BigInt(0),
    balanceLocked: userMeToken.balanceLocked || BigInt(0),
    startTime: BigInt(0),
    endTime: BigInt(0),
    endCooldown: BigInt(0),
    targetHubId: 0,
    migration: false,
    collateralSymbol: collateral.symbol,
    collateralDisplayName: collateral.displayName,
  };
}

/**
 * Merge indexed holdings with the creator's own MeToken without double-counting.
 * Dedupes by token address (not only isOwnMeToken), and marks a matching
 * indexed row as owned when the addresses match.
 */
export function mergeHoldingsWithOwnMeToken(
  holdings: MeTokenHolding[] | null | undefined,
  userMeToken: MeTokenData | null | undefined,
  ownerAddress: string
): MeTokenHolding[] {
  const list = holdings ?? [];
  if (!userMeToken?.address) return list;

  const ownAddress = userMeToken.address.toLowerCase();
  const alreadyPresent = list.some(
    (h) => h.address.toLowerCase() === ownAddress
  );

  if (alreadyPresent) {
    return list.map((h) =>
      h.address.toLowerCase() === ownAddress
        ? { ...h, isOwnMeToken: true }
        : h
    );
  }

  return [buildOwnHoldingFallback(userMeToken, ownerAddress), ...list];
}
