import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { CampaignFormSchema } from "@/lib/validations/campaign";
import { groveService } from "@/lib/sdk/grove/service";
import {
  insertShoppableCampaign,
  insertShoppableProductKit,
} from "@/lib/sdk/supabase/shoppable-campaigns";
import { serverLogger } from "@/lib/utils/logger";

/**
 * POST /api/campaigns
 * Brand creates a pending shoppable campaign + Grove product kit.
 */
export async function POST(req: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  try {
    const json = await req.json();
    const parsed = CampaignFormSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const body = parsed.data;
    if (!body.brandAddress) {
      return NextResponse.json(
        { error: "brandAddress is required" },
        { status: 400 }
      );
    }
    const brandAddress = body.brandAddress.toLowerCase();

    try {
      await requireWalletAuthFor(req, brandAddress);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { error: authErr.message },
          { status: authErr.status }
        );
      }
      throw authErr;
    }

    const grovePayload = {
      version: "1.0",
      brand: {
        name: body.brandName,
        handle: body.brandHandle,
        logo: body.brandLogoUrl,
      },
      product: {
        title: body.campaignTitle,
        image: body.productImageUrl,
        url: body.purchaseUrl,
        description: body.campaignDescription,
      },
      parameters: {
        targetCreator: body.targetCreator.toLowerCase(),
        budgetUsdc: body.budgetUsdc ?? null,
        startDate: body.startDate.toISOString(),
        endDate: body.endDate.toISOString(),
      },
    };

    const grove = await groveService.uploadJson(grovePayload);
    if (!grove.success || !grove.hash) {
      return NextResponse.json(
        { error: grove.error || "Grove upload failed" },
        { status: 502 }
      );
    }

    const ipfsUri = grove.hash.startsWith("ipfs://")
      ? grove.hash
      : `ipfs://${grove.hash}`;

    const campaign = await insertShoppableCampaign({
      brandAddress,
      creatorAddress: body.targetCreator,
      startDate: body.startDate,
      endDate: body.endDate,
      budgetUsdc: body.budgetUsdc,
    });

    const productKit = await insertShoppableProductKit({
      campaignId: campaign.id,
      ipfsHash: grove.hash,
      brandName: body.brandName,
      brandHandle: body.brandHandle,
      brandLogoUrl: body.brandLogoUrl,
      productImageUrl: body.productImageUrl,
      purchaseUrl: body.purchaseUrl,
      title: body.campaignTitle,
      description: body.campaignDescription,
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      productKitId: productKit.id,
      ipfsUri,
      hash: grove.hash,
      url: grove.url,
    });
  } catch (error) {
    serverLogger.error("[POST /api/campaigns] failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create campaign",
      },
      { status: 500 }
    );
  }
}
