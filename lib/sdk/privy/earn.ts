import { formatUnits } from "viem";
import { getPrivyClient } from "./client";
import { basisPointsToPercent, getEarnVaultId } from "./config";

export type EarnVaultSummary = {
  id: string;
  name: string;
  provider: string;
  userApyPercent: string | null;
  tvlUsd: number | null;
  availableLiquidityUsd: number | null;
  assetSymbol: string;
  assetDecimals: number;
};

export type EarnPositionSummary = {
  assetsInVault: string;
  assetsInVaultFormatted: string;
  totalDeposited: string;
  totalWithdrawn: string;
  earnedYield: string;
  earnedYieldFormatted: string;
  sharesInVault: string;
  assetSymbol: string;
  assetDecimals: number;
};

export type EarnActionSummary = {
  id: string;
  status: string;
  type: string;
};

function toPositionSummary(position: {
  asset: { decimals: number; symbol: string };
  assets_in_vault: string;
  total_deposited: string;
  total_withdrawn: string;
  shares_in_vault: string;
}): EarnPositionSummary {
  const decimals = position.asset.decimals;
  const symbol = position.asset.symbol.toUpperCase();

  const assetsInVault = BigInt(position.assets_in_vault);
  const totalDeposited = BigInt(position.total_deposited);
  const totalWithdrawn = BigInt(position.total_withdrawn);
  const earnedYield =
    assetsInVault - (totalDeposited - totalWithdrawn);

  return {
    assetsInVault: position.assets_in_vault,
    assetsInVaultFormatted: formatUnits(assetsInVault, decimals),
    totalDeposited: position.total_deposited,
    totalWithdrawn: position.total_withdrawn,
    earnedYield: earnedYield.toString(),
    earnedYieldFormatted: formatUnits(
      earnedYield > 0n ? earnedYield : 0n,
      decimals,
    ),
    sharesInVault: position.shares_in_vault,
    assetSymbol: symbol,
    assetDecimals: decimals,
  };
}

function toVaultSummary(vault: {
  id: string;
  name: string;
  provider: string;
  user_apy: number | null;
  tvl_usd: number | null;
  available_liquidity_usd: number | null;
  asset: { symbol: string; decimals: number };
}): EarnVaultSummary {
  return {
    id: vault.id,
    name: vault.name,
    provider: vault.provider,
    userApyPercent: basisPointsToPercent(vault.user_apy),
    tvlUsd: vault.tvl_usd,
    availableLiquidityUsd: vault.available_liquidity_usd,
    assetSymbol: vault.asset.symbol.toUpperCase(),
    assetDecimals: vault.asset.decimals,
  };
}

export async function fetchVaultDetails(): Promise<EarnVaultSummary> {
  const privy = getPrivyClient();
  const vaultId = getEarnVaultId();
  const details =
    await privy.wallets().earn().ethereum().vaultDetails(vaultId);
  return toVaultSummary(details);
}

export async function fetchVaultPosition(
  walletId: string,
): Promise<EarnPositionSummary> {
  const privy = getPrivyClient();
  const vaultId = getEarnVaultId();
  const position = await privy
    .wallets()
    .earn()
    .ethereum()
    .vaultPosition(walletId, { vault_id: vaultId });
  return toPositionSummary(position);
}

export async function depositToVault(
  walletId: string,
  amount: string,
  userJwt: string,
) {
  const privy = getPrivyClient();
  const vaultId = getEarnVaultId();
  return privy.wallets().earn().ethereum().deposit(walletId, {
    vault_id: vaultId,
    amount,
    authorization_context: { user_jwts: [userJwt] },
  });
}

export async function withdrawFromVault(
  walletId: string,
  amount: string,
  userJwt: string,
) {
  const privy = getPrivyClient();
  const vaultId = getEarnVaultId();
  return privy.wallets().earn().ethereum().withdraw(walletId, {
    vault_id: vaultId,
    amount,
    authorization_context: { user_jwts: [userJwt] },
  });
}

export async function withdrawAllFromVault(
  walletId: string,
  rawAmount: string,
  userJwt: string,
) {
  const privy = getPrivyClient();
  const vaultId = getEarnVaultId();
  return privy.wallets().earn().ethereum().withdraw(walletId, {
    vault_id: vaultId,
    raw_amount: rawAmount,
    authorization_context: { user_jwts: [userJwt] },
  });
}

export async function fetchWalletAction(
  walletId: string,
  actionId: string,
) {
  const privy = getPrivyClient();
  return privy.wallets().actions.get(actionId, { wallet_id: walletId });
}
