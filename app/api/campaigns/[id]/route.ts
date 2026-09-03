import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { CampaignProposalPatchSchema } from "@/lib/validations/campaign";
import {
  getShoppableCampaignById,
  updateShoppableCampaignProposal,
} from "@/lib/sdk/supabase/shoppable-campaigns";
import { serverLogger } from "@/lib/utils/logger";

/**
 * PATCH /api/campaigns/[id]
 * Attach Snapshot proposal id after governance submission.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "campaign id required" }, { status: 400 });
  }

  try {
    const campaign = await getShoppableCampaignById(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    try {
      await requireWalletAuthFor(req, campaign.brand_address);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { error: authErr.message },
          { status: authErr.status }
        );
      }
      throw authErr;
    }

    const json = await req.json();
    const parsed = CampaignProposalPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await updateShoppableCampaignProposal(
      id,
      parsed.data.snapshotProposalId
    );

    return NextResponse.json({ success: true, campaign: updated });
  } catch (error) {
    serverLogger.error("[PATCH /api/campaigns/:id] failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update campaign",
      },
      { status: 500 }
    );
  }
}
