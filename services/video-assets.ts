"use server";
// services/video-assets.ts

import { createClient } from "@/lib/sdk/supabase/server";
import { createServiceClient } from "@/lib/sdk/supabase/service";
import type { VideoAsset } from "@/lib/types/video-asset";
import { fullLivepeer } from "@/lib/sdk/livepeer/fullClient";
import type { CollaboratorFormData } from "@/lib/types/splits";

export async function createVideoAsset(
  data: Omit<VideoAsset, "id" | "created_at" | "updated_at">,
  collaborators?: CollaboratorFormData[]
) {
  // Use service client to bypass RLS since we're using smart account addresses
  // which don't match Supabase JWT authentication
  const supabase = createServiceClient();

  // Check if video asset with this asset_id already exists
  const { data: existingAsset } = await supabase
    .from('video_assets')
    .select('*')
    .eq('asset_id', data.asset_id)
    .maybeSingle();

  // If asset already exists, return it instead of creating a duplicate
  if (existingAsset) {
    console.log(`Video asset with asset_id ${data.asset_id} already exists, returning existing asset`);

    // Update collaborators if provided and different from existing
    if (collaborators && collaborators.length > 0 && existingAsset.id) {
      // Check if collaborators need to be updated
      const { data: existingCollaborators } = await supabase
        .from('video_collaborators')
        .select('*')
        .eq('video_id', existingAsset.id);

      // Only update if collaborators are different
      // Note: share_percentage is stored in basis points (0-10000), where 10000 = 100%
      // collab.percentage is a percentage (0-100), so we convert to basis points for comparison
      const needsUpdate = !existingCollaborators ||
        existingCollaborators.length !== collaborators.length ||
        collaborators.some((collab, index) => {
          const existing = existingCollaborators[index];
          return !existing ||
            existing.collaborator_address.toLowerCase() !== collab.address.toLowerCase() ||
            existing.share_percentage !== Math.round(collab.percentage * 100);
        });

      if (needsUpdate) {
        // Delete existing collaborators
        await supabase
          .from('video_collaborators')
          .delete()
          .eq('video_id', existingAsset.id);

        // Insert new collaborators
        const collaboratorInserts = collaborators.map((collab, index) => {
          let sharePercentage = Math.round(collab.percentage * 100);

          if (index === collaborators.length - 1) {
            const previousTotal = collaborators
              .slice(0, -1)
              .reduce((sum, c) => sum + Math.round(c.percentage * 100), 0);
            sharePercentage = 10000 - previousTotal;
            if (sharePercentage < 0) sharePercentage = 0;
            if (sharePercentage > 10000) sharePercentage = 10000;
          }

          return {
            video_id: existingAsset.id,
            collaborator_address: collab.address,
            share_percentage: sharePercentage,
          };
        });

        await supabase
          .from('video_collaborators')
          .insert(collaboratorInserts);
      }
    }

    return existingAsset;
  }

  // Create new video asset
  const { data: result, error } = await supabase
    .from('video_assets')
    .insert({
      title: data.title,
      asset_id: data.asset_id,
      category: data.category,
      location: data.location,
      playback_id: data.playback_id,
      description: data.description,
      creator_id: data.creator_id,
      status: data.status,
      thumbnail_url: data.thumbnailUri,
      duration: data.duration,
      price: data.price,
      max_supply: data.max_supply,
      views_count: data.views_count || 0,
      likes_count: data.likes_count || 0,
      is_minted: data.is_minted || false,
      token_id: data.token_id,
      contract_address: data.contract_address,
      minted_at: data.minted_at,
      mint_transaction_hash: data.mint_transaction_hash,
      royalty_percentage: data.royalty_percentage,
      current_supply: data.current_supply || 0,
      metadata_uri: data.metadata_uri,
      attributes: data.attributes,
      requires_metoken: data.requires_metoken || false,
      metoken_price: data.metoken_price || null,
      creator_metoken_id: data.creator_metoken_id || null,
      story_ip_registered: data.story_ip_registered || false,
      story_ip_id: data.story_ip_id || null,
      story_ip_registration_tx: data.story_ip_registration_tx || null,
      story_ip_registered_at: data.story_ip_registered_at || null,
      story_license_terms_id: data.story_license_terms_id || null,
      story_license_template_id: data.story_license_template_id || null,
      splits_address: null, // Will be set when split contract is created during publish
      livepeer_attestation_id: data.livepeer_attestation_id ?? null,
    })
    .select()
    .single();

  if (error) {
    // Provide more specific error message for duplicate key constraint
    if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
      throw new Error(`A video asset with this asset ID already exists. Please use a different video or check your existing uploads.`);
    }
    throw new Error(`Failed to create video asset: ${error.message}`);
  }

  // Store collaborators if provided
  if (collaborators && collaborators.length > 0 && result?.id) {
    // Convert percentages to basis points, ensuring total equals exactly 10000
    // This handles rounding errors from decimal percentages (e.g., 33.333% + 33.333% + 33.334% = 100%)
    const collaboratorInserts = collaborators.map((collab, index) => {
      // Convert to basis points (0-10000)
      let sharePercentage = Math.round(collab.percentage * 100);

      // For the last collaborator, adjust to ensure total equals exactly 10000
      // This compensates for rounding errors in previous collaborators
      if (index === collaborators.length - 1) {
        // Calculate what the total would be without this last collaborator
        const previousTotal = collaborators
          .slice(0, -1)
          .reduce((sum, c) => sum + Math.round(c.percentage * 100), 0);

        // Set the last collaborator's share to make the total exactly 10000
        sharePercentage = 10000 - previousTotal;

        // Ensure it's within valid range (0-10000)
        if (sharePercentage < 0) sharePercentage = 0;
        if (sharePercentage > 10000) sharePercentage = 10000;
      }

      return {
        video_id: result.id,
        collaborator_address: collab.address,
        share_percentage: sharePercentage,
      };
    });

    const { error: collabError } = await supabase
      .from('video_collaborators')
      .insert(collaboratorInserts);

    if (collabError) {
      console.error('Failed to store collaborators:', collabError);
      // Don't throw - video asset is created, collaborators can be added later
    }
  }

  return result;
}

export interface CreateClipVideoAssetParams {
  assetId: string;
  playbackId: string;
  playbackUrl?: string | null;
  thumbnailUrl?: string | null;
  name?: string | null;
  parentPlaybackId: string;
  parentStoryIpId?: string | null;
  clipStartMs: number;
  clipEndMs: number;
  clipperAddress: string;
}

export async function createClipVideoAsset(params: CreateClipVideoAssetParams) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("video_assets")
    .select("*")
    .eq("asset_id", params.assetId)
    .maybeSingle();
  if (existing) return existing;

  const title = params.name?.trim() || `Clip of ${params.parentPlaybackId.slice(0, 8)}`;
  const durationSec = Math.max(0, Math.round((params.clipEndMs - params.clipStartMs) / 1000));

  const { data, error } = await supabase
    .from("video_assets")
    .insert({
      title,
      asset_id: params.assetId,
      playback_id: params.playbackId,
      category: "clip",
      location: "",
      description: null,
      creator_id: params.clipperAddress.toLowerCase(),
      status: "draft",
      duration: durationSec,
      views_count: 0,
      likes_count: 0,
      is_minted: false,
      current_supply: 0,
      thumbnail_url: params.thumbnailUrl ?? null,
      source_type: "Clip",
      parent_playback_id: params.parentPlaybackId,
      parent_story_ip_id: params.parentStoryIpId ?? null,
      clip_start_ms: params.clipStartMs,
      clip_end_ms: params.clipEndMs,
      clipper_address: params.clipperAddress.toLowerCase(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create clip video asset: ${error.message}`);
  }

  return data;
}

export async function listClipsByParentPlaybackId(
  parentPlaybackId: string,
  limit: number = 20
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_assets")
    .select(
      "id, title, playback_id, thumbnail_url, status, is_minted, duration, clip_start_ms, clip_end_ms, clipper_address, token_id, story_ip_id, contract_address, created_at"
    )
    .eq("source_type", "Clip")
    .eq("parent_playback_id", parentPlaybackId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list clips: ${error.message}`);
  }
  return data ?? [];
}

export async function getVideoAssetById(id: number) {
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from('video_assets')
    .select('*')
    .eq('id', id)
    .maybeSingle(); // Use maybeSingle() instead of single()

  if (error) {
    throw new Error(`Failed to get video asset: ${error.message}`);
  }

  return result; // This will be null if no record found
}

/**
 * Helper function to execute Supabase query with timeout and retry logic
 */
async function executeWithTimeoutAndRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  timeoutMs: number = 10000, // 10 seconds default timeout
  maxRetries: number = 2
): Promise<T | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Query timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Race between query and timeout
      const { data, error } = await Promise.race([
        queryFn(),
        timeoutPromise,
      ]);

      // Check for Supabase errors
      if (error) {
        // Check if error message contains HTML (Cloudflare error page)
        const errorMessage = error.message || String(error);
        if (errorMessage.includes('<!DOCTYPE html>') || errorMessage.includes('<html')) {
          throw new Error('Supabase service temporarily unavailable (500). Please try again in a few minutes.');
        }

        // Check for connection/timeout errors
        if (
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('ETIMEDOUT') ||
          error.code === 'PGRST116' // PostgREST connection error
        ) {
          lastError = new Error(`Database connection error: ${errorMessage}`);
          // Retry on connection errors
          if (attempt < maxRetries) {
            // Exponential backoff: 500ms, 1000ms
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
            continue;
          }
        }

        throw new Error(`Database query error: ${errorMessage}`);
      }

      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on timeout or non-retryable errors
      if (
        lastError.message.includes('timeout') ||
        lastError.message.includes('Supabase service temporarily unavailable') ||
        attempt >= maxRetries
      ) {
        throw lastError;
      }

      // Exponential backoff for retries
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
    }
  }

  throw lastError || new Error('Failed to execute query after retries');
}

export interface VideoAssetPlaybackData {
  id: number;
  status: string;
  thumbnail_url: string | null;
  creator_metoken_id: string | null;
  attributes: Record<string, any> | null;
  title: string;
  story_ip_registered?: boolean;
  story_ip_id?: string | null;
}

export async function getVideoAssetByPlaybackId(playbackId: string): Promise<VideoAssetPlaybackData | null> {
  const supabase = await createClient();

  // Cast supabase to any to resolve issue where missing Database types cause return to be inferred as 'never'
  const result = await executeWithTimeoutAndRetry<VideoAssetPlaybackData>(
    async () => {
      return await (supabase as any)
        .from('video_assets')
        .select('id, status, thumbnail_url, creator_metoken_id, attributes, title, story_ip_registered, story_ip_id')
        .eq('playback_id', playbackId)
        .maybeSingle();
    },
    10000, // 10 second timeout
    2 // 2 retries
  );

  return result; // This will be null if no record found, or the single record if found
}

export async function getVideoAssetByAssetId(assetId: string) {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(assetId)) {
    throw new Error(`Invalid asset ID: ${assetId}. Asset ID must be a valid UUID.`);
  }

  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from('video_assets')
    .select('*')
    .eq('asset_id', assetId)
    .maybeSingle(); // Use maybeSingle() instead of single()

  if (error) {
    throw new Error(`Failed to get video asset by asset ID: ${error.message}`);
  }

  return result; // This will be null if no record found
}

export async function updateVideoAssetMintingStatus(
  id: number,
  mintingData: {
    token_id: string;
    contract_address: string;
    mint_transaction_hash: string;
  }
) {
  // Use service client to bypass RLS
  const supabase = createServiceClient();

  const { data: result, error } = await supabase
    .from('video_assets')
    .update({
      is_minted: true,
      token_id: mintingData.token_id,
      contract_address: mintingData.contract_address,
      mint_transaction_hash: mintingData.mint_transaction_hash,
      minted_at: new Date().toISOString(),
      status: 'minted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update video asset minting status: ${error.message}`);
  }

  return result;
}

/**
 * Update Story Protocol IP registration status for a video asset
 */
export async function updateVideoAssetStoryIPStatus(
  id: number,
  storyData: {
    story_ip_registered: boolean;
    story_ip_id: string;
    story_ip_registration_tx: string;
    story_license_terms_id?: string | null;
    story_license_template_id?: string | null;
  }
) {
  // Use service client to bypass RLS
  const supabase = createServiceClient();

  const { data: result, error } = await supabase
    .from('video_assets')
    .update({
      story_ip_registered: storyData.story_ip_registered,
      story_ip_id: storyData.story_ip_id,
      story_ip_registration_tx: storyData.story_ip_registration_tx,
      story_ip_registered_at: new Date().toISOString(),
      story_license_terms_id: storyData.story_license_terms_id || null,
      story_license_template_id: storyData.story_license_template_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update Story Protocol IP status: ${error.message}`);
  }

  return result;
}

export async function updateVideoAsset(
  id: number,
  data: {
    thumbnailUri?: string;
    status?: string;
    title?: string;
    description?: string | null;
    category?: string;
    location?: string;
    max_supply?: number | null;
    price?: number | null;
    royalty_percentage?: number | null;
    metadata_uri?: string | null;
    requires_metoken?: boolean;
    metoken_price?: number | null;
    attributes?: Record<string, any> | null;
    contract_address?: string | null;
    token_id?: string | null;
    story_ip_registered?: boolean;
    story_ip_id?: string | null;
    story_ip_registration_tx?: string | null;
    story_ip_registered_at?: Date | null;
    story_license_terms_id?: string | null;
    story_license_template_id?: string | null;
    splits_address?: string | null;
    creator_metoken_id?: string | null;
    livepeer_attestation_id?: string | null;
  }
) {
  // Use service client to bypass RLS
  const supabase = createServiceClient();

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  // Only include fields if they are provided
  if (data.thumbnailUri !== undefined) {
    updateData.thumbnail_url = data.thumbnailUri;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.category !== undefined) {
    updateData.category = data.category;
  }
  if (data.location !== undefined) {
    updateData.location = data.location;
  }
  if (data.max_supply !== undefined) {
    updateData.max_supply = data.max_supply;
  }
  if (data.price !== undefined) {
    updateData.price = data.price;
  }
  if (data.royalty_percentage !== undefined) {
    updateData.royalty_percentage = data.royalty_percentage;
  }
  if (data.metadata_uri !== undefined) {
    updateData.metadata_uri = data.metadata_uri;
  }
  if (data.requires_metoken !== undefined) {
    updateData.requires_metoken = data.requires_metoken;
  }
  if (data.metoken_price !== undefined) {
    updateData.metoken_price = data.metoken_price;
  }
  if (data.attributes !== undefined) {
    updateData.attributes = data.attributes;
  }
  if (data.contract_address !== undefined) {
    updateData.contract_address = data.contract_address;
  }
  if (data.token_id !== undefined) {
    updateData.token_id = data.token_id;
  }
  if (data.story_ip_registered !== undefined) {
    updateData.story_ip_registered = data.story_ip_registered;
  }
  if (data.story_ip_id !== undefined) {
    updateData.story_ip_id = data.story_ip_id;
  }
  if (data.story_ip_registration_tx !== undefined) {
    updateData.story_ip_registration_tx = data.story_ip_registration_tx;
  }
  if (data.story_ip_registered_at !== undefined) {
    updateData.story_ip_registered_at = data.story_ip_registered_at?.toISOString();
  }
  if (data.story_license_terms_id !== undefined) {
    updateData.story_license_terms_id = data.story_license_terms_id;
  }
  if (data.story_license_template_id !== undefined) {
    updateData.story_license_template_id = data.story_license_template_id;
  }
  if (data.splits_address !== undefined) {
    updateData.splits_address = data.splits_address;
  }
  if (data.creator_metoken_id !== undefined) {
    updateData.creator_metoken_id = data.creator_metoken_id;
  }
  if (data.livepeer_attestation_id !== undefined) {
    updateData.livepeer_attestation_id = data.livepeer_attestation_id;
  }

  const { data: result, error } = await supabase
    .from('video_assets')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update video asset: ${error.message}`);
  }

  return result;
}

export interface GetPublishedVideoAssetsOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'views_count' | 'likes_count' | 'updated_at';
  order?: 'asc' | 'desc';
  creatorId?: string;
  category?: string;
  search?: string;
}

/**
 * Fetch published video assets from Supabase with advanced filtering and search
 * This is the primary function for retrieving videos at scale
 */
export async function getPublishedVideoAssets(options: GetPublishedVideoAssetsOptions = {}) {
  const supabase = await createClient();

  let query = supabase
    .from('video_assets')
    .select('*', { count: 'exact' })
    .eq('status', 'published');

  // Add creator filter if specified (case-insensitive comparison)
  if (options.creatorId) {
    // Normalize to lowercase for consistent matching
    // Since creator_id might be stored in checksum format (mixed case), we need case-insensitive comparison
    const normalizedCreatorId = options.creatorId.toLowerCase();
    // Use ilike for case-insensitive matching (handles both checksum and lowercase addresses)
    query = query.ilike('creator_id', normalizedCreatorId);
  }

  // Add category filter if specified
  if (options.category) {
    query = query.eq('category', options.category);
  }

  // Add full-text search if specified (searches title and description)
  if (options.search && options.search.trim()) {
    // Use text search across title and description
    const searchTerm = options.search.trim();
    query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
  }

  // Add ordering
  const orderBy = options.orderBy || 'created_at';
  const order = options.order || 'desc';
  query = query.order(orderBy, { ascending: order === 'asc' });

  // Add pagination
  if (options.limit) {
    const offset = options.offset || 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch published videos: ${error.message}`);
  }

  return {
    data: data || [],
    total: count || 0,
    hasMore: options.limit ? (count || 0) > (options.offset || 0) + (options.limit || 0) : false
  };
}

export interface GetStoryIPAssetsOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'updated_at' | 'story_ip_registered_at';
  order?: 'asc' | 'desc';
}

/**
 * Fetch video assets that are registered as Story Protocol IP (Creative TV IP marketplace source).
 */
export async function getVideoAssetsWithStoryIP(options: GetStoryIPAssetsOptions = {}) {
  const supabase = await createClient();

  const orderBy = options.orderBy || 'story_ip_registered_at';
  const order = options.order || 'desc';

  let query = supabase
    .from('video_assets')
    .select('*', { count: 'exact' })
    .eq('status', 'published')
    .eq('story_ip_registered', true)
    .order(orderBy, { ascending: order === 'asc' });

  if (options.limit != null) {
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch Story IP assets: ${error.message}`);
  }

  return {
    data: data || [],
    total: count ?? 0,
    hasMore: options.limit != null ? (count ?? 0) > (options.offset ?? 0) + options.limit : false,
  };
}

export interface MultistreamTarget {
  id?: string;
  name?: string;
  url?: string; // Not in SDK, but we use it for UI
  createdAt?: number;
  userId?: string;
  disabled?: boolean;
}

export interface CreateMultistreamTargetParams {
  streamId: string;
  name: string;
  url: string;
  profile?: string;
  videoOnly?: boolean;
}

export interface CreateMultistreamTargetResult {
  target?: MultistreamTarget;
  error?: string;
}

export async function createMultistreamTarget({
  streamId,
  name,
  url,
  profile = "720p0",
  videoOnly = false,
}: CreateMultistreamTargetParams): Promise<CreateMultistreamTargetResult> {
  if (!streamId || !url) {
    return { error: "Missing streamId or URL" };
  }

  // Name is optional - provide default if not given
  const targetName = name || `Target ${Date.now()}`;

  try {
    const target = await fullLivepeer.stream.addMultistreamTarget(
      {
        profile,
        videoOnly,
        spec: { name: targetName, url },
      },
      streamId
    );

    if (!target) {
      return { error: "Failed to create multistream target" };
    }

    return { target: { ...target, url, name: targetName } };
  } catch (e: any) {
    console.error("Error creating multistream target:", e);
    return {
      error: e?.message || "Failed to create multistream target"
    };
  }
}

export interface ListMultistreamTargetsResult {
  targets?: MultistreamTarget[];
  error?: string;
}

export interface ListMultistreamTargetsParams {
  streamId: string;
}

/**
 * Lists multistream targets for a specific stream.
 * According to Livepeer docs, multistream targets are stream-specific.
 * 
 * @param streamId - The Livepeer stream ID to fetch targets for
 * @returns List of multistream targets for the specified stream
 */
export async function listMultistreamTargets(
  { streamId }: ListMultistreamTargetsParams
): Promise<ListMultistreamTargetsResult> {
  if (!streamId) {
    return { error: "Stream ID is required" };
  }

  try {
    // Fetch the stream to get its multistream targets
    const stream = await fullLivepeer.stream.get(streamId);

    if (!stream || !stream.stream) {
      return { error: "Stream not found" };
    }

    // Extract multistream targets from the stream object
    // Livepeer API returns targets in stream.multistream.targets
    const targets = stream.stream.multistream?.targets || [];

    if (!Array.isArray(targets)) {
      return { error: "Invalid multistream targets format" };
    }

    return { targets: targets as MultistreamTarget[] };
  } catch (e: any) {
    console.error("Error fetching multistream targets:", e);
    return {
      error: e?.message || "Failed to fetch multistream targets"
    };
  }
}

export interface DeleteMultistreamTargetParams {
  id: string;
}

export interface DeleteMultistreamTargetResult {
  success: boolean;
  error?: string;
}

export async function deleteMultistreamTarget({
  id,
}: DeleteMultistreamTargetParams): Promise<DeleteMultistreamTargetResult> {
  if (!id) return { success: false, error: "Missing target ID" };
  try {
    await fullLivepeer.multistream.delete(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to delete multistream target" };
  }
}


/**
 * Delete a video asset from both Livepeer and the database
 */
export async function deleteVideoAsset(assetId: string, creatorId: string) {
  // Use service client to bypass RLS for deletion
  const supabase = createServiceClient();

  // 1. Verify ownership
  const { data: asset } = await supabase
    .from('video_assets')
    .select('creator_id')
    .eq('asset_id', assetId)
    .single();

  if (!asset) {
    throw new Error('Asset not found');
  }

  // Normalize IDs for comparison (handle case differences)
  if (asset.creator_id.toLowerCase() !== creatorId.toLowerCase()) {
    throw new Error('Unauthorized: You can only delete your own videos');
  }

  // 2. Delete from Livepeer
  try {
    await fullLivepeer.asset.delete(assetId);
  } catch (error: any) {
    console.error('Error deleting from Livepeer:', error);
    // Proceed to delete from DB even if Livepeer fails (e.g. if already deleted)
  }

  // 3. Delete from DB
  const { error: dbError } = await supabase
    .from('video_assets')
    .delete()
    .eq('asset_id', assetId);

  if (dbError) {
    throw new Error(`Failed to delete from database: ${dbError.message}`);
  }

  return { success: true };
}
