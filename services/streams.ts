"use server";

import { createClient } from "../lib/sdk/supabase/server";
import { createServiceClient } from "../lib/sdk/supabase/service";
import {
  verifyWalletAuthArgs,
  WalletAuthError,
  type WalletAuthArgs,
} from "@/lib/auth/require-wallet";
import { isPermittedSigner } from "@/lib/utils/linked-identity";
import { serverLogger } from "@/lib/utils/logger";

export interface Stream {
    id: string;
    creator_id: string;
    stream_key: string;
    stream_id: string;
    playback_id: string;
    thumbnail_url?: string | null;
    name?: string | null;
    is_live: boolean;
    last_live_at?: string | null;
    allow_clipping?: boolean;
    save_recording?: boolean;
    story_ip_id?: string | null;
    story_license_terms_id?: string | null;
    story_ip_registration_tx?: string | null;
    story_ip_registered_at?: string | null;
    story_commercial_rev_share?: number | null;
    requires_metoken?: boolean;
    metoken_price?: number | null;
    /** Lens post ID for going-live announcement; chat = comments on this post. */
    lens_live_post_id?: string | null;
    created_at: string;
    updated_at: string;
}

export type CreateStreamParams = Omit<Stream, "id" | "created_at" | "updated_at">;
export type UpdateStreamParams = Partial<
  Pick<
    Stream,
    | "thumbnail_url"
    | "name"
    | "is_live"
    | "last_live_at"
    | "allow_clipping"
    | "save_recording"
    | "requires_metoken"
    | "metoken_price"
    | "lens_live_post_id"
  >
>;

const CLIENT_MUTABLE_STREAM_FIELDS = new Set<keyof UpdateStreamParams>([
  "thumbnail_url",
  "name",
  "is_live",
  "last_live_at",
  "allow_clipping",
  "save_recording",
  "requires_metoken",
  "metoken_price",
  "lens_live_post_id",
]);

async function authorizeStreamOwner(
  creatorId: string,
  auth: WalletAuthArgs,
): Promise<string> {
  const { address: caller } = await verifyWalletAuthArgs(auth);
  const normalizedCreator = creatorId.trim().toLowerCase();

  if (caller === normalizedCreator) {
    return caller;
  }

  const permitted =
    (await isPermittedSigner(normalizedCreator, caller)) ||
    (await isPermittedSigner(caller, normalizedCreator));

  if (!permitted) {
    throw new WalletAuthError(403, "Not authorized to modify this stream");
  }

  return caller;
}

/**
 * Get a stream by creator ID (wallet address)
 */
export async function getStreamByCreator(creatorId: string) {
    const supabase = await createServiceClient(); // Use service client to bypass RLS initially or ensure reliable fetch

    // Normalize creator ID
    const normalizedCreatorId = creatorId.toLowerCase();

    const { data, error } = await supabase
        .from("streams")
        .select("*")
        .ilike("creator_id", normalizedCreatorId) // Case-insensitive match
        .maybeSingle();

    if (error) {
        console.error("Error fetching stream by creator:", error);
        throw new Error(`Failed to fetch stream: ${error.message}`);
    }

    return data as Stream | null;
}

function uniqueAddresses(addresses: Array<string | null | undefined>): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const addr of addresses) {
        const normalized = addr?.trim().toLowerCase();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

async function collectLegacyCreatorCandidates(
    normalizedSca: string,
    legacySignerAddress?: string | null,
): Promise<string[]> {
    const candidates = uniqueAddresses([legacySignerAddress]);

    try {
        const supabase = await createServiceClient();
        const { data: profiles } = await supabase
            .from("creator_profiles")
            .select("owner_address")
            .ilike("owner_address", normalizedSca);

        if (profiles?.length) {
            for (const row of profiles) {
                const owner = row.owner_address?.toLowerCase();
                if (owner && owner !== normalizedSca) {
                    candidates.push(owner);
                }
            }
        }
    } catch (error) {
        serverLogger.warn("[resolveStreamForCreator] creator_profiles lookup failed", {
            normalizedSca,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    return uniqueAddresses(candidates).filter((addr) => addr !== normalizedSca);
}

async function migrateStreamCreatorId(
    legacyStream: Stream,
    normalizedSca: string,
    legacyAddress: string,
): Promise<Stream> {
    const permitted = await isPermittedSigner(legacyAddress, normalizedSca);
    if (!permitted) {
        serverLogger.warn("[resolveStreamForCreator] migration denied — signer not permitted", {
            legacyAddress,
            normalizedSca,
            streamId: legacyStream.id,
        });
        return legacyStream;
    }

    const supabase = await createServiceClient();
    const { data, error } = await supabase
        .from("streams")
        .update({
            creator_id: normalizedSca,
            updated_at: new Date().toISOString(),
        })
        .eq("id", legacyStream.id)
        .select()
        .single();

    if (error) {
        serverLogger.error("[resolveStreamForCreator] migration update failed", {
            legacyAddress,
            normalizedSca,
            streamId: legacyStream.id,
            error: error.message,
        });
        return legacyStream;
    }

    serverLogger.info("[resolveStreamForCreator] migrated stream creator_id", {
        legacyAddress,
        normalizedSca,
        streamId: legacyStream.id,
    });

    return data as Stream;
}

/**
 * Resolve a creator's stream by smart-account address, migrating legacy EOA-keyed rows.
 */
export async function resolveStreamForCreator(
    smartAccountAddress: string,
    legacySignerAddress?: string | null,
): Promise<Stream | null> {
    const normalizedSca = smartAccountAddress.toLowerCase();
    const existing = await getStreamByCreator(normalizedSca);
    if (existing) return existing;

    const legacyCandidates = await collectLegacyCreatorCandidates(
        normalizedSca,
        legacySignerAddress,
    );

    if (legacyCandidates.length === 0) {
        serverLogger.debug("[resolveStreamForCreator] no legacy candidates", { normalizedSca });
        return null;
    }

    for (const legacy of legacyCandidates) {
        const legacyStream = await getStreamByCreator(legacy);
        if (!legacyStream) continue;

        const migrated = await migrateStreamCreatorId(legacyStream, normalizedSca, legacy);
        if (migrated.creator_id.toLowerCase() === normalizedSca) {
            return migrated;
        }
    }

    serverLogger.warn("[resolveStreamForCreator] legacy streams found but migration failed", {
        normalizedSca,
        legacyCandidates,
    });
    return null;
}

/**
 * Get a stream by Livepeer stream ID
 */
export async function getStreamByStreamId(streamId: string) {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
        .from("streams")
        .select("*")
        .eq("stream_id", streamId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching stream by stream ID:", error);
        throw new Error(`Failed to fetch stream: ${error.message}`);
    }

    return data as Stream | null;
}

/**
 * Get a stream by playback ID
 */
export async function getStreamByPlaybackId(playbackId: string) {
    const supabase = await createClient(); // Use regular client for public read

    const { data, error } = await supabase
        .from("streams")
        .select("id, creator_id, playback_id, thumbnail_url, name, is_live, last_live_at, allow_clipping, save_recording, requires_metoken, metoken_price, story_ip_id, story_license_terms_id, story_commercial_rev_share, story_ip_registered_at, lens_live_post_id")
        .eq("playback_id", playbackId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching stream by playback ID:", error);
        throw new Error(`Failed to fetch stream: ${error.message}`);
    }

    return data as Partial<Stream> | null;
}

/**
 * Create a new persistent stream record
 */
export async function createStreamRecord(params: CreateStreamParams) {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
        .from("streams")
        .insert({
            ...params,
            creator_id: params.creator_id.toLowerCase(), // Ensure lowercase storage
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating stream record:", error);
        throw new Error(`Failed to create stream record: ${error.message}`);
    }

    return data as Stream;
}

/**
 * Update an existing stream record
 */
export async function updateStream(
    creatorId: string,
    updates: UpdateStreamParams,
    auth: WalletAuthArgs,
) {
    await authorizeStreamOwner(creatorId, auth);

    const safeUpdates: UpdateStreamParams = {};
    for (const [key, value] of Object.entries(updates)) {
        if (CLIENT_MUTABLE_STREAM_FIELDS.has(key as keyof UpdateStreamParams)) {
            (safeUpdates as Record<string, unknown>)[key] = value;
        }
    }

    if (Object.keys(safeUpdates).length === 0) {
        throw new WalletAuthError(400, "No valid stream fields to update");
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
        .from("streams")
        .update({
            ...safeUpdates,
            updated_at: new Date().toISOString(),
        })
        .ilike("creator_id", creatorId)
        .select()
        .single();

    if (error) {
        console.error("Error updating stream record:", error);
        throw new Error(`Failed to update stream: ${error.message}`);
    }

    return data as Stream;
}

/**
 * Record Story Protocol IP registration for a stream
 */
export async function updateStreamStoryIp(
    creatorId: string,
    storyData: {
        story_ip_id: string;
        story_license_terms_id?: string | null;
        story_ip_registration_tx: string;
        story_commercial_rev_share?: number | null;
    }
) {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
        .from("streams")
        .update({
            story_ip_id: storyData.story_ip_id,
            story_license_terms_id: storyData.story_license_terms_id ?? null,
            story_ip_registration_tx: storyData.story_ip_registration_tx,
            story_ip_registered_at: new Date().toISOString(),
            story_commercial_rev_share: storyData.story_commercial_rev_share ?? null,
            updated_at: new Date().toISOString(),
        })
        .ilike("creator_id", creatorId)
        .select()
        .single();

    if (error) {
        console.error("Error updating stream Story IP status:", error);
        throw new Error(`Failed to update stream Story IP: ${error.message}`);
    }

    return data as Stream;
}

export interface ActiveStream {
    id: string;
    creator_id: string;
    playback_id: string;
    thumbnail_url?: string | null;
    name?: string | null;
    is_live: boolean;
    last_live_at?: string | null;
    requires_metoken?: boolean;
    created_at: string;
}

/**
 * Server-side helper to mark a stream live by Livepeer stream ID.
 * Used by webhooks when Livepeer reports stream.started; bypasses wallet-auth
 * because the caller is Livepeer, not an end user.
 */
export async function markStreamLiveByStreamId(streamId: string) {
    const supabase = await createServiceClient();
    const now = new Date().toISOString();

    const { error } = await supabase
        .from("streams")
        .update({
            is_live: true,
            last_live_at: now,
            updated_at: now,
        })
        .eq("stream_id", streamId);

    if (error) {
        serverLogger.error("Error marking stream live by stream ID:", error);
        throw new Error(`Failed to mark stream live: ${error.message}`);
    }
}

/**
 * Server-side helper to mark a stream offline by Livepeer stream ID.
 * Used by webhooks when Livepeer reports stream.idle; bypasses wallet-auth
 * because the caller is Livepeer, not an end user.
 */
export async function markStreamOfflineByStreamId(streamId: string) {
    const supabase = await createServiceClient();

    const { error } = await supabase
        .from("streams")
        .update({
            is_live: false,
            updated_at: new Date().toISOString(),
        })
        .eq("stream_id", streamId);

    if (error) {
        serverLogger.error("Error marking stream offline by stream ID:", error);
        throw new Error(`Failed to mark stream offline: ${error.message}`);
    }
}

/**
 * Get all active streams from the database
 */
export async function getActiveStreams() {
    const supabase = await createClient(); // Use regular client for public read

    const { data, error } = await supabase
        .from("streams")
        .select("id, creator_id, playback_id, thumbnail_url, name, is_live, last_live_at, requires_metoken, created_at")
        .eq("is_live", true)
        .order("last_live_at", { ascending: false });

    if (error) {
        console.error("Error fetching active streams:", error);
        // Return empty array instead of throwing to avoid breaking UI
        return [];
    }

    return data as ActiveStream[];
}
