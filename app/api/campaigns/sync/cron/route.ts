import { NextRequest, NextResponse } from "next/server";
import { gql } from "@apollo/client";
import { makeServerClient } from "@/lib/apollo-server-client";
import {
  getProductKitByCampaignId,
  listActivePastEndCampaigns,
  listPendingShoppableCampaigns,
  listVideosNeedingDetection,
  updateShoppableCampaignStatus,
  updateShoppableVideoDetection,
} from "@/lib/sdk/supabase/shoppable-campaigns";
import { queueVideoDetection } from "@/lib/shoppable/trigger-detection";
import { serverLogger } from "@/lib/utils/logger";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type SnapshotProposal = {
  id: string;
  choices: string[];
  scores: number[];
  state: string;
};

async function fetchProposal(id: string): Promise<SnapshotProposal | null> {
  const client = makeServerClient();
  const { data, error } = await client.query<{
    proposal: SnapshotProposal | null;
  }>({
    query: gql`
      query ($id: String!) {
        proposal(id: $id) {
          id
          choices
          scores
          state
        }
      }
    `,
    variables: { id },
    fetchPolicy: "no-cache",
  });
  if (error) throw error;
  return data?.proposal ?? null;
}

function winningChoiceIndex(scores: number[]): number {
  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if ((scores[i] ?? 0) > (scores[best] ?? 0)) best = i;
  }
  return best;
}

/**
 * GET /api/campaigns/sync/cron
 * Resolve Snapshot outcomes + re-enqueue stuck detections.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    activated: 0,
    rejected: 0,
    expired: 0,
    requeued: 0,
    accepted202: 0,
    errors: [] as string[],
  };

  try {
    const pending = await listPendingShoppableCampaigns(100);
    for (const campaign of pending) {
      if (!campaign.snapshot_proposal_id) continue;
      try {
        const proposal = await fetchProposal(campaign.snapshot_proposal_id);
        if (!proposal || proposal.state !== "closed") continue;
        const scores = proposal.scores ?? [];
        const choices = proposal.choices ?? [];
        if (scores.length === 0 || choices.length === 0) {
          summary.errors.push(
            `proposal ${campaign.snapshot_proposal_id}: empty scores or choices`
          );
          continue;
        }
        const winnerIdx = winningChoiceIndex(scores);
        const winner = (choices[winnerIdx] || "").toLowerCase();
        if (winner === "yes") {
          await updateShoppableCampaignStatus(campaign.id, "active");
          summary.activated += 1;
        } else {
          await updateShoppableCampaignStatus(campaign.id, "rejected");
          summary.rejected += 1;
        }
      } catch (err) {
        summary.errors.push(
          `proposal ${campaign.snapshot_proposal_id}: ${
            err instanceof Error ? err.message : "error"
          }`
        );
      }
    }

    const expired = await listActivePastEndCampaigns(100);
    for (const campaign of expired) {
      try {
        await updateShoppableCampaignStatus(campaign.id, "expired");
        summary.expired += 1;
      } catch (err) {
        summary.errors.push(
          `expire ${campaign.id}: ${
            err instanceof Error ? err.message : "error"
          }`
        );
      }
    }

    const stuck = await listVideosNeedingDetection(50);
    for (const video of stuck) {
      try {
        const kit = await getProductKitByCampaignId(video.campaign_id);
        if (!kit) continue;
        const queued = await queueVideoDetection({
          campaignId: video.campaign_id,
          videoId: video.id,
          livepeerAssetId: video.livepeer_asset_id,
          productImageUrl: kit.product_image_url,
          productKitId: kit.id,
        });
        if (queued.ok) {
          await updateShoppableVideoDetection(video.id, {
            detectionStatus: "processing",
          });
          summary.requeued += 1;
        } else if (queued.status === 202) {
          summary.accepted202 += 1;
        } else {
          summary.errors.push(`queue ${video.id}: ${queued.reason}`);
        }
      } catch (err) {
        summary.errors.push(
          `video ${video.id}: ${err instanceof Error ? err.message : "error"}`
        );
      }
    }

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    serverLogger.error("[campaigns/sync/cron] failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cron failed",
        ...summary,
      },
      { status: 500 }
    );
  }
}
