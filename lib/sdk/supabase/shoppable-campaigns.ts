import { createServiceClient } from "@/lib/sdk/supabase/service";

export type ShoppableCampaignStatus =
  | "pending"
  | "active"
  | "rejected"
  | "expired";

export type ShoppableDetectionStatus =
  | "idle"
  | "queued"
  | "processing"
  | "ready"
  | "failed";

export type ShoppableCampaignRow = {
  id: string;
  snapshot_proposal_id: string | null;
  brand_address: string;
  creator_address: string;
  status: ShoppableCampaignStatus;
  start_date: string;
  end_date: string;
  budget_usdc: number | null;
  created_at: string;
  updated_at: string;
};

export type ShoppableProductKitRow = {
  id: string;
  campaign_id: string;
  ipfs_hash: string;
  brand_name: string;
  brand_handle: string;
  brand_logo_url: string;
  product_image_url: string;
  purchase_url: string;
  title: string;
  description: string | null;
  created_at: string;
};

export type ShoppableVideoRow = {
  id: string;
  campaign_id: string;
  livepeer_asset_id: string;
  livepeer_playback_id: string;
  video_asset_id: number | null;
  duration: number | null;
  detection_status: ShoppableDetectionStatus;
  detection_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ShoppableAnnotationRow = {
  id: string;
  video_id: string;
  product_kit_id: string;
  start_time: number;
  end_time: number;
  bounding_box: number[];
  created_at: string;
};

function db() {
  return createServiceClient();
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export async function insertShoppableCampaign(input: {
  brandAddress: string;
  creatorAddress: string;
  startDate: Date | string;
  endDate: Date | string;
  budgetUsdc?: number;
  snapshotProposalId?: string | null;
}): Promise<ShoppableCampaignRow> {
  const { data, error } = await db()
    .from("shoppable_campaigns")
    .insert({
      brand_address: normalizeAddress(input.brandAddress),
      creator_address: normalizeAddress(input.creatorAddress),
      start_date: input.startDate,
      end_date: input.endDate,
      budget_usdc: input.budgetUsdc ?? null,
      snapshot_proposal_id: input.snapshotProposalId ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data as ShoppableCampaignRow;
}

export async function insertShoppableProductKit(input: {
  campaignId: string;
  ipfsHash: string;
  brandName: string;
  brandHandle: string;
  brandLogoUrl: string;
  productImageUrl: string;
  purchaseUrl: string;
  title: string;
  description?: string | null;
}): Promise<ShoppableProductKitRow> {
  const { data, error } = await db()
    .from("shoppable_product_kits")
    .insert({
      campaign_id: input.campaignId,
      ipfs_hash: input.ipfsHash,
      brand_name: input.brandName,
      brand_handle: input.brandHandle,
      brand_logo_url: input.brandLogoUrl,
      product_image_url: input.productImageUrl,
      purchase_url: input.purchaseUrl,
      title: input.title,
      description: input.description ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ShoppableProductKitRow;
}

export async function getShoppableCampaignById(
  id: string
): Promise<ShoppableCampaignRow | null> {
  const { data, error } = await db()
    .from("shoppable_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as ShoppableCampaignRow) ?? null;
}

export async function updateShoppableCampaignProposal(
  campaignId: string,
  snapshotProposalId: string
): Promise<ShoppableCampaignRow> {
  const { data, error } = await db()
    .from("shoppable_campaigns")
    .update({ snapshot_proposal_id: snapshotProposalId })
    .eq("id", campaignId)
    .select()
    .single();

  if (error) throw error;
  return data as ShoppableCampaignRow;
}

export async function updateShoppableCampaignStatus(
  campaignId: string,
  status: ShoppableCampaignStatus
): Promise<ShoppableCampaignRow> {
  const { data, error } = await db()
    .from("shoppable_campaigns")
    .update({ status })
    .eq("id", campaignId)
    .select()
    .single();

  if (error) throw error;
  return data as ShoppableCampaignRow;
}

export async function listPendingShoppableCampaigns(
  limit = 100
): Promise<ShoppableCampaignRow[]> {
  const { data, error } = await db()
    .from("shoppable_campaigns")
    .select("*")
    .eq("status", "pending")
    .not("snapshot_proposal_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data as ShoppableCampaignRow[]) ?? [];
}

export async function listActivePastEndCampaigns(
  limit = 100
): Promise<ShoppableCampaignRow[]> {
  const { data, error } = await db()
    .from("shoppable_campaigns")
    .select("*")
    .eq("status", "active")
    .lt("end_date", new Date().toISOString())
    .limit(limit);

  if (error) throw error;
  return (data as ShoppableCampaignRow[]) ?? [];
}

export async function getProductKitByCampaignId(
  campaignId: string
): Promise<ShoppableProductKitRow | null> {
  const { data, error } = await db()
    .from("shoppable_product_kits")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) throw error;
  return (data as ShoppableProductKitRow) ?? null;
}

export async function getShoppableVideoByCampaignId(
  campaignId: string
): Promise<ShoppableVideoRow | null> {
  const { data, error } = await db()
    .from("shoppable_videos")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) throw error;
  return (data as ShoppableVideoRow) ?? null;
}

export async function upsertShoppableVideo(input: {
  campaignId: string;
  livepeerAssetId: string;
  livepeerPlaybackId: string;
  videoAssetId?: number | null;
  duration?: number | null;
  detectionStatus?: ShoppableDetectionStatus;
}): Promise<ShoppableVideoRow> {
  const { data, error } = await db()
    .from("shoppable_videos")
    .upsert(
      {
        campaign_id: input.campaignId,
        livepeer_asset_id: input.livepeerAssetId,
        livepeer_playback_id: input.livepeerPlaybackId,
        video_asset_id: input.videoAssetId ?? null,
        duration: input.duration ?? null,
        detection_status: input.detectionStatus ?? "queued",
        detection_error: null,
      },
      { onConflict: "campaign_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as ShoppableVideoRow;
}

export async function updateShoppableVideoDetection(
  videoId: string,
  patch: {
    detectionStatus: ShoppableDetectionStatus;
    detectionError?: string | null;
    duration?: number | null;
  }
): Promise<ShoppableVideoRow> {
  const { data, error } = await db()
    .from("shoppable_videos")
    .update({
      detection_status: patch.detectionStatus,
      detection_error: patch.detectionError ?? null,
      ...(patch.duration !== undefined ? { duration: patch.duration } : {}),
    })
    .eq("id", videoId)
    .select()
    .single();

  if (error) throw error;
  return data as ShoppableVideoRow;
}

export async function listVideosNeedingDetection(
  limit = 50
): Promise<ShoppableVideoRow[]> {
  const { data, error } = await db()
    .from("shoppable_videos")
    .select("*")
    .in("detection_status", ["queued", "processing"])
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data as ShoppableVideoRow[]) ?? [];
}

export async function replaceShoppableAnnotations(input: {
  videoId: string;
  productKitId: string;
  annotations: Array<{
    startTime: number;
    endTime: number;
    boundingBox: number[];
  }>;
}): Promise<ShoppableAnnotationRow[]> {
  const client = db();
  const { error: deleteError } = await client
    .from("shoppable_annotations")
    .delete()
    .eq("video_id", input.videoId);

  if (deleteError) throw deleteError;

  if (input.annotations.length === 0) return [];

  const { data, error } = await client
    .from("shoppable_annotations")
    .insert(
      input.annotations.map((a) => ({
        video_id: input.videoId,
        product_kit_id: input.productKitId,
        start_time: a.startTime,
        end_time: a.endTime,
        bounding_box: a.boundingBox,
      }))
    )
    .select();

  if (error) throw error;
  return (data as ShoppableAnnotationRow[]) ?? [];
}

export type PlaybackOverlayPayload = {
  campaignId: string;
  annotations: Array<{
    id: string;
    startTime: number;
    endTime: number;
    boundingBox: [number, number, number, number];
    productKit: {
      brandName: string;
      brandHandle: string;
      brandLogoUrl: string;
      productImageUrl: string;
      purchaseUrl: string;
      title: string;
    };
  }>;
};

export async function getActiveOverlayByPlaybackId(
  playbackId: string
): Promise<PlaybackOverlayPayload | null> {
  const { data: video, error: videoError } = await db()
    .from("shoppable_videos")
    .select("id, campaign_id, detection_status")
    .eq("livepeer_playback_id", playbackId)
    .eq("detection_status", "ready")
    .maybeSingle();

  if (videoError) throw videoError;
  if (!video) return null;

  const campaign = await getShoppableCampaignById(video.campaign_id);
  if (!campaign || campaign.status !== "active") return null;

  const now = Date.now();
  if (
    new Date(campaign.start_date).getTime() > now ||
    new Date(campaign.end_date).getTime() < now
  ) {
    return null;
  }

  const kit = await getProductKitByCampaignId(campaign.id);
  if (!kit) return null;

  const { data: annotations, error: annError } = await db()
    .from("shoppable_annotations")
    .select("*")
    .eq("video_id", video.id)
    .order("start_time", { ascending: true });

  if (annError) throw annError;

  return {
    campaignId: campaign.id,
    annotations: ((annotations as ShoppableAnnotationRow[]) ?? []).map((a) => ({
      id: a.id,
      startTime: a.start_time,
      endTime: a.end_time,
      boundingBox: a.bounding_box as [number, number, number, number],
      productKit: {
        brandName: kit.brand_name,
        brandHandle: kit.brand_handle,
        brandLogoUrl: kit.brand_logo_url,
        productImageUrl: kit.product_image_url,
        purchaseUrl: kit.purchase_url,
        title: kit.title,
      },
    })),
  };
}
