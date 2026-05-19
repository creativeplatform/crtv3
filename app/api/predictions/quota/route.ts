import { NextRequest, NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { isAddress } from "viem";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { supabaseService } from "@/lib/sdk/supabase/service";
import {
  countPredictionMarketsThisMonthUtc,
  getPremiumPredictionAccess,
  normalizeCreatorAddress,
  PREDICTION_MARKETS_MONTHLY_LIMIT,
} from "@/lib/predictions/prediction-quota";
import { unlockService } from "@/lib/sdk/unlock/services";

export async function GET(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Valid address query parameter is required" },
      { status: 400 }
    );
  }

  if (!supabaseService) {
    return NextResponse.json(
      { error: "Quota service unavailable" },
      { status: 503 }
    );
  }

  try {
    const normalized = normalizeCreatorAddress(address);
    const memberships = await unlockService.getAllMemberships(normalized);
    const { unlimited, tier } = getPremiumPredictionAccess(memberships);

    if (unlimited) {
      return NextResponse.json({
        unlimited: true,
        premiumTier: tier,
        usedThisMonth: 0,
        monthlyLimit: PREDICTION_MARKETS_MONTHLY_LIMIT,
        remaining: null,
      });
    }

    const usedThisMonth = await countPredictionMarketsThisMonthUtc(normalized);
    const remaining = Math.max(0, PREDICTION_MARKETS_MONTHLY_LIMIT - usedThisMonth);

    return NextResponse.json({
      unlimited: false,
      premiumTier: null,
      usedThisMonth,
      monthlyLimit: PREDICTION_MARKETS_MONTHLY_LIMIT,
      remaining,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load quota" },
      { status: 500 }
    );
  }
}
