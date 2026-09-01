import { createServiceClient } from "@/lib/sdk/supabase/service";

export type CampaignStickerRow = {
  id: string;
  token_id: number;
  proposal_id: string;
  ipfs_hash: string;
  metadata: Record<string, unknown> | null;
  brand_address: string;
  name: string | null;
  image_uri: string | null;
  created_at: string;
};

export type StickerClaimRow = {
  id: string;
  token_id: number;
  wallet: string;
  tx_hash: string | null;
  vp: number | null;
  choice: string | null;
  created_at: string;
};

export type StickerTipRow = {
  id: string;
  video_id: string;
  wallet: string;
  sticker_token_id: number | null;
  sticker_ipfs_hash: string | null;
  composite_hash: string;
  seconds: number;
  usdc_amount: number;
  tx_hash: string | null;
  created_at: string;
};

function db() {
  return createServiceClient();
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export async function insertCampaignSticker(input: {
  tokenId: number;
  proposalId: string;
  ipfsHash: string;
  brandAddress: string;
  name?: string;
  imageUri?: string;
  metadata?: Record<string, unknown>;
}): Promise<CampaignStickerRow> {
  const { data, error } = await db()
    .from("campaign_stickers")
    .insert({
      token_id: input.tokenId,
      proposal_id: input.proposalId,
      ipfs_hash: input.ipfsHash,
      brand_address: normalizeAddress(input.brandAddress),
      name: input.name ?? null,
      image_uri: input.imageUri ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as CampaignStickerRow;
}

export async function getStickerByProposal(
  proposalId: string
): Promise<CampaignStickerRow | null> {
  const { data, error } = await db()
    .from("campaign_stickers")
    .select("*")
    .eq("proposal_id", proposalId)
    .maybeSingle();

  if (error) throw error;
  return (data as CampaignStickerRow) ?? null;
}

export async function listCampaignStickers(limit = 200): Promise<CampaignStickerRow[]> {
  const { data, error } = await db()
    .from("campaign_stickers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as CampaignStickerRow[]) ?? [];
}

export async function insertStickerClaim(input: {
  tokenId: number;
  wallet: string;
  txHash?: string;
  vp?: number;
  choice?: string;
}): Promise<StickerClaimRow> {
  const { data, error } = await db()
    .from("sticker_claims")
    .upsert(
      {
        token_id: input.tokenId,
        wallet: normalizeAddress(input.wallet),
        tx_hash: input.txHash ?? null,
        vp: input.vp ?? null,
        choice: input.choice ?? null,
      },
      { onConflict: "token_id,wallet" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as StickerClaimRow;
}

export async function insertStickerTip(input: {
  videoId: string;
  wallet: string;
  stickerTokenId?: number | null;
  stickerIpfsHash?: string | null;
  compositeHash: string;
  seconds: number;
  usdcAmount: number;
  txHash?: string;
}): Promise<StickerTipRow> {
  const { data, error } = await db()
    .from("sticker_tips")
    .insert({
      video_id: input.videoId,
      wallet: normalizeAddress(input.wallet),
      sticker_token_id: input.stickerTokenId ?? null,
      sticker_ipfs_hash: input.stickerIpfsHash ?? null,
      composite_hash: input.compositeHash,
      seconds: input.seconds,
      usdc_amount: input.usdcAmount,
      tx_hash: input.txHash ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as StickerTipRow;
}

export async function listStickerTipsForVideo(
  videoId: string,
  wallet?: string,
  limit = 100
): Promise<StickerTipRow[]> {
  const normalized = wallet ? normalizeAddress(wallet) : null;
  const query = db()
    .from("sticker_tips")
    .select("*")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (normalized) {
    query.eq("wallet", normalized);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data as StickerTipRow[]) ?? [];
}
