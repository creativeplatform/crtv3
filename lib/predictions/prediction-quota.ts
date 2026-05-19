import { unlockService, LOCK_ADDRESSES } from "@/lib/sdk/unlock/services";
import { supabaseService } from "@/lib/sdk/supabase/service";
import { serverLogger } from "@/lib/utils/logger";
import { getAddress, isAddress } from "viem";

/** Non–premium accounts: max new prediction markets per calendar month (UTC). */
export const PREDICTION_MARKETS_MONTHLY_LIMIT = 3;

/**
 * Investor and Brand passes (MembershipHome naming).
 * Creator tier (BASE_CREATIVE_PASS_2) shares the monthly limit with non-members.
 */
export const UNLIMITED_PREDICTION_LOCK_ADDRESSES = new Set(
  [
    LOCK_ADDRESSES.BASE_CREATIVE_PASS,
    LOCK_ADDRESSES.BASE_CREATIVE_PASS_3,
  ].map((a) => a.toLowerCase())
);

export type PredictionPremiumTier = "investor" | "brand";

export function normalizeCreatorAddress(address: string): string {
  if (!isAddress(address)) {
    throw new Error("Invalid wallet address");
  }
  return getAddress(address).toLowerCase();
}

export function getPremiumPredictionAccess(
  memberships: Awaited<ReturnType<typeof unlockService.getAllMemberships>>
): { unlimited: boolean; tier: PredictionPremiumTier | null } {
  let tier: PredictionPremiumTier | null = null;
  for (const m of memberships) {
    if (!m.isValid) continue;
    const a = m.address.toLowerCase();
    if (a === LOCK_ADDRESSES.BASE_CREATIVE_PASS.toLowerCase()) {
      tier = "brand";
      break;
    }
    if (a === LOCK_ADDRESSES.BASE_CREATIVE_PASS_3.toLowerCase()) {
      tier = "investor";
      break;
    }
  }
  return { unlimited: tier !== null, tier };
}

export async function hasUnlimitedPredictionMarkets(
  userAddress: string
): Promise<boolean> {
  const memberships = await unlockService.getAllMemberships(userAddress);
  return getPremiumPredictionAccess(memberships).unlimited;
}

function startOfUtcMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

export async function countPredictionMarketsThisMonthUtc(
  creatorAddressLower: string
): Promise<number> {
  if (!supabaseService) {
    serverLogger.error("prediction quota: supabaseService not configured");
    throw new Error("Database not configured");
  }

  const start = startOfUtcMonth().toISOString();

  const { count, error } = await supabaseService
    .from("prediction_market_creations")
    .select("*", { count: "exact", head: true })
    .eq("creator_address", creatorAddressLower)
    .gte("created_at", start);

  if (error) {
    serverLogger.error("prediction quota: count failed", error);
    throw error;
  }

  return count ?? 0;
}
