/**
 * Estimate a wallet's redeemable MeToken value from vault TVL.
 *
 * MeToken hubs on Creative use USD-pegged stables, so vault collateral ≈ USD:
 *   (balance / totalSupply) × vaultTvlUsd
 *
 * Decimals:
 * - MeToken ERC-20 balances / supply: always 18
 * - Vault collateral (balancePooled/Locked): hub-dependent
 *   - USDC hub → 6 decimals
 *   - DAI / USDS / GHO hubs → 18 decimals
 * Callers must pass vaultTvlUsd already converted with hub-aware formatting
 * (see calculateMeTokenVaultTvlUsd).
 *
 * This is an estimate — bonding-curve exit price can differ slightly from pro-rata.
 */

export type MeTokenHoldingValueInput = {
  /** Wallet balance in wei (18 decimals for MeTokens). */
  balanceRaw: bigint;
  /** ERC-20 totalSupply in wei. */
  totalSupply: bigint;
  /** Vault collateral TVL already converted to USD units (stablecoin amount). */
  vaultTvlUsd: number;
};

/**
 * Pro-rata estimated USD value of a MeToken holding (including the creator's own).
 */
export function estimateMeTokenHoldingValueUsd({
  balanceRaw,
  totalSupply,
  vaultTvlUsd,
}: MeTokenHoldingValueInput): number {
  if (balanceRaw <= BigInt(0) || totalSupply <= BigInt(0) || !(vaultTvlUsd > 0)) {
    return 0;
  }

  // Apply share first in float so tiny ownership (balance << supply) does not
  // truncate to 0 under fixed-scale bigint division (e.g. SCALE=1e6).
  // Number() loses absolute bigint precision, but the ratio is what we need for USD UI.
  const share = Number(balanceRaw) / Number(totalSupply);
  if (!Number.isFinite(share) || share <= 0) return 0;

  const value = share * vaultTvlUsd;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Sum estimated holding values for a portfolio list.
 */
export function sumMeTokenHoldingValuesUsd(
  holdings: Array<{ holdingValueUsd?: number }>
): number {
  return holdings.reduce((sum, h) => sum + (h.holdingValueUsd ?? 0), 0);
}

/**
 * Format a small/large USD holding for UI chips.
 */
export function formatMeTokenHoldingUsd(value: number): string {
  if (!(value > 0)) return "$0.00";
  if (value < 0.01) return "<$0.01";
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1_000_000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${(value / 1_000_000).toFixed(1)}M`;
}
