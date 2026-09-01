import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { z } from "zod";
import { isAddress } from "viem";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { supabaseService } from "@/lib/sdk/supabase/service";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { verifyPredictionCreationTx } from "@/lib/predictions/verifyPredictionCreationTx";
import { TransactionVerificationError } from "@/lib/chain/verifyTransactionReceipt";
import {
  countPredictionMarketsThisMonthUtc,
  getPremiumPredictionAccess,
  normalizeCreatorAddress,
  PREDICTION_MARKETS_MONTHLY_LIMIT,
} from "@/lib/predictions/prediction-quota";
import { unlockService } from "@/lib/sdk/unlock/services";
import { isPlatformAdmin } from "@/lib/access/platform-admin";
import { hasValidCreatorPass } from "@/lib/access/creator-membership";

const bodySchema = z.object({
  address: z.string().refine(isAddress, "Invalid address"),
  transactionHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  questionId: z.string().min(1).optional(),
  title: z.string().optional(),
  category: z.string().optional(),
  questionType: z.string().optional(),
  outcomes: z.array(z.string()).optional(),
  videoAssetId: z.string().uuid("Invalid videoAssetId").optional(),
});

export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
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

  const { address, transactionHash, questionId, title, category, questionType, outcomes, videoAssetId } =
    parsed.data;

  try {
    const normalized = normalizeCreatorAddress(address);

    try {
      await requireWalletAuthFor(request, normalized);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json({ error: authErr.message }, { status: authErr.status });
      }
      throw authErr;
    }

    let verifiedQuestionId: string | undefined;
    try {
      const verified = await verifyPredictionCreationTx(transactionHash, normalized);
      verifiedQuestionId = verified.questionId;
      if (questionId && questionId.toLowerCase() !== verified.questionId.toLowerCase()) {
        return NextResponse.json(
          { error: "questionId does not match on-chain transaction" },
          { status: 400 },
        );
      }
    } catch (verifyErr) {
      if (verifyErr instanceof TransactionVerificationError) {
        return NextResponse.json({ error: verifyErr.message }, { status: 400 });
      }
      throw verifyErr;
    }

    const memberships = await unlockService.getAllMemberships(normalized);

    if (!isPlatformAdmin(normalized) && hasValidCreatorPass(memberships)) {
      return NextResponse.json(
        {
          error: "Creator members cannot create prediction markets",
          code: "CREATOR_TIER_BLOCKED",
        },
        { status: 403 }
      );
    }

    const { unlimited } = getPremiumPredictionAccess(memberships);

    const finalQuestionId = questionId ?? verifiedQuestionId ?? null;

    // Video link is attempted for ALL creators (including admin/premium, who
    // skip the quota insert) so video-page strips never miss their markets.
    // Best-effort: the market already exists on-chain at this point, so a link
    // failure must not fail the record (that would also skip quota counting
    // and dead-end client retries). `linked` in the response tells the client
    // whether the video strip will show this market.
    let linked: boolean | null = null;
    if (videoAssetId && finalQuestionId) {
      linked = false;
      const { data: videoRow, error: videoLookupError } = await supabaseService
        .from("video_assets")
        .select("id")
        .eq("asset_id", videoAssetId)
        .maybeSingle();

      if (!videoLookupError && videoRow) {
        // Upsert: a question links to exactly one video; re-recording the same
        // tx (client retry) must not 23505 the quota insert below.
        const { error: linkError } = await supabaseService
          .from("prediction_video_links")
          .upsert(
            {
              question_id: finalQuestionId.toLowerCase(),
              video_asset_id: videoRow.id,
              created_by: normalized,
            },
            { onConflict: "question_id", ignoreDuplicates: true }
          );

        if (!linkError) {
          linked = true;
        }
      }
    }

    if (unlimited || isPlatformAdmin(normalized)) {
      return NextResponse.json({ recorded: false, unlimited: true, linked });
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
        question_id: finalQuestionId,
        title: title ?? null,
        category: category ?? null,
        question_type: questionType ?? null,
        outcomes: outcomes?.length ? outcomes : null,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ recorded: true, duplicate: true, linked });
      }
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ recorded: true, unlimited: false, linked });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to record" },
      { status: 500 }
    );
  }
}
