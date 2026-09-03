import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { AttachVideoSchema } from "@/lib/validations/campaign";
import { createServiceClient } from "@/lib/sdk/supabase/service";
import {
  getProductKitByCampaignId,
  getShoppableCampaignById,
  upsertShoppableVideo,
  updateShoppableVideoDetection,
} from "@/lib/sdk/supabase/shoppable-campaigns";
import { queueVideoDetection } from "@/lib/shoppable/trigger-detection";
import { serverLogger } from "@/lib/utils/logger";

/**
 * POST /api/campaigns/[id]/attach-video
 * Link a creator VOD to the campaign and enqueue Gemini detection via QStash.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  const { id: campaignId } = await params;
  if (!campaignId) {
    return NextResponse.json({ error: "campaign id required" }, { status: 400 });
  }

  try {
    const campaign = await getShoppableCampaignById(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const json = await req.json();
    const parsed = AttachVideoSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const callerCandidates = [campaign.brand_address, campaign.creator_address];
    let authorized = false;
    let lastAuthError: WalletAuthError | null = null;
    for (const addr of callerCandidates) {
      try {
        await requireWalletAuthFor(req, addr);
        authorized = true;
        break;
      } catch (err) {
        if (err instanceof WalletAuthError) {
          lastAuthError = err;
          continue;
        }
        throw err;
      }
    }
    if (!authorized && lastAuthError) {
      return NextResponse.json(
        { error: lastAuthError.message },
        { status: lastAuthError.status }
      );
    }

    const supabase = createServiceClient();
    const { data: videoAsset, error: videoError } = await supabase
      .from("video_assets")
      .select("id, asset_id, playback_id, creator_id, duration")
      .eq("playback_id", parsed.data.playbackId)
      .maybeSingle();

    if (videoError) throw videoError;
    if (!videoAsset) {
      return NextResponse.json(
        { error: "Video not found for playbackId" },
        { status: 404 }
      );
    }

    if (
      String(videoAsset.creator_id).toLowerCase() !==
      campaign.creator_address.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "playbackId creator does not match campaign target creator" },
        { status: 403 }
      );
    }

    if (!videoAsset.asset_id) {
      return NextResponse.json(
        { error: "Video is missing Livepeer asset id" },
        { status: 400 }
      );
    }

    const productKit = await getProductKitByCampaignId(campaignId);
    if (!productKit) {
      return NextResponse.json(
        { error: "Product kit missing for campaign" },
        { status: 400 }
      );
    }

    const video = await upsertShoppableVideo({
      campaignId,
      livepeerAssetId: videoAsset.asset_id,
      livepeerPlaybackId: videoAsset.playback_id,
      videoAssetId: videoAsset.id,
      duration: videoAsset.duration ?? null,
      detectionStatus: "queued",
    });

    const queued = await queueVideoDetection({
      campaignId,
      videoId: video.id,
      livepeerAssetId: video.livepeer_asset_id,
      productImageUrl: productKit.product_image_url,
      productKitId: productKit.id,
    });

    if (!queued.ok) {
      if (queued.status === 202) {
        return NextResponse.json(
          {
            success: true,
            accepted: true,
            video,
            message: queued.reason,
          },
          { status: 202 }
        );
      }
      await updateShoppableVideoDetection(video.id, {
        detectionStatus: "failed",
        detectionError: queued.reason,
      });
      return NextResponse.json({ error: queued.reason }, { status: 503 });
    }

    await updateShoppableVideoDetection(video.id, {
      detectionStatus: "processing",
    });

    return NextResponse.json({
      success: true,
      video,
      messageId: queued.messageId,
    });
  } catch (error) {
    serverLogger.error("[attach-video] failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to attach video",
      },
      { status: 500 }
    );
  }
}
