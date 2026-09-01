import type { VideoAsset } from '@/lib/types/video-asset';

export type ClipLensShareInput = {
  assetId: string;
  playbackId: string;
  title: string;
  thumbnailUrl?: string | null;
  clipperAddress: string;
  clipVideoAssetId?: number;
};

/** Minimal VideoAsset for Lens video() metadata from a viewer-created clip. */
export function clipToVideoAsset(input: ClipLensShareInput): VideoAsset {
  const now = new Date();
  return {
    id: input.clipVideoAssetId ?? 0,
    title: input.title,
    asset_id: input.assetId,
    playback_id: input.playbackId,
    thumbnailUri: input.thumbnailUrl ?? '',
    creator_id: input.clipperAddress.toLowerCase(),
    category: 'clip',
    location: '',
    description: null,
    status: 'draft',
    duration: null,
    views_count: 0,
    likes_count: 0,
    is_minted: false,
    token_id: null,
    contract_address: null,
    minted_at: null,
    mint_transaction_hash: null,
    royalty_percentage: null,
    price: null,
    max_supply: null,
    current_supply: 0,
    metadata_uri: null,
    attributes: null,
    requires_metoken: false,
    metoken_price: null,
    creator_metoken_id: null,
    subtitles_uri: null,
    subtitles: null,
    story_ip_registered: false,
    story_ip_id: null,
    story_ip_registration_tx: null,
    story_ip_registered_at: null,
    story_license_terms_id: null,
    story_license_template_id: null,
    splits_address: null,
    livepeer_attestation_id: null,
    source_type: 'Clip',
    created_at: now,
    updated_at: now,
  } as VideoAsset;
}
