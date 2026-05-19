import { NextRequest, NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { z } from "zod";
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

const bodySchema = z.object({
  address: z.string().refine(isAddress, "Invalid address"),
  transactionHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  questionId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  if (!supabaseService) {
    return NextResponse.json(
      { error: "Record service unavailable" },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { address, transactionHash, questionId } = parsed.data;

  try {
    const normalized = normalizeCreatorAddress(address);
    const memberships = await unlockService.getAllMemberships(normalized);
    const { unlimited } = getPremiumPredictionAccess(memberships);

    if (unlimited) {
      return NextResponse.json({ recorded: false, unlimited: true });
    }

    const used = await countPredictionMarketsThisMonthUtc(normalized);
    if (used >= PREDICTION_MARKETS_MONTHLY_LIMIT) {
      return NextResponse.json(
        {
          error: "Monthly prediction limit reached",
          code: "PREDICTION_QUOTA_EXCEEDED",
          monthlyLimit: PREDICTION_MARKETS_MONTHLY_LIMIT,
          usedThisMonth: used,
        },
        { status: 403 }
      );
    }

    const { error: insertError } = await supabaseService
      .from("prediction_market_creations")
      .insert({
        creator_address: normalized,
        transaction_hash: transactionHash.toLowerCase(),
        question_id: questionId ?? null,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ recorded: true, duplicate: true });
      }
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ recorded: true, unlimited: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to record" },
      { status: 500 }
    );
  }
}
