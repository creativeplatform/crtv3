"use server";

import { createServiceClient } from "../lib/sdk/supabase/service";
import { getStreamByCreator } from "./streams";
import {
  verifyWalletAuthArgs,
  WalletAuthError,
  type WalletAuthArgs,
} from "../lib/auth/require-wallet";

export interface ModerationState {
  hiddenIds: string[];
  bannedAddresses: string[];
  moderators: string[];
}

export interface ModeratorRecord {
  moderator_address: string;
  appointed_by: string;
  appointed_at: string;
}

/**
 * Look up the streams row for the moderation key. The chat keys moderation by
 * playback_id (matches the URL/session id), so we check that first and fall
 * back to stream_id for the rare creator-side flow that hands us the Livepeer
 * stream id directly.
 */
async function lookupStream(streamId: string) {
  const supabase = createServiceClient();
  const { data: byPlayback, error: pbErr } = await supabase
    .from("streams")
    .select("creator_id")
    .eq("playback_id", streamId)
    .maybeSingle();
  if (pbErr) throw new Error(pbErr.message);
  if (byPlayback) return byPlayback;

  const { data: byStream, error: sErr } = await supabase
    .from("streams")
    .select("creator_id")
    .eq("stream_id", streamId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  return byStream;
}

/**
 * Verify the caller's wallet signature, then confirm the verified address is
 * either the stream's creator or an appointed moderator. Returns the verified
 * lowercase address for use in audit columns (`hidden_by`, `banned_by`, etc.).
 */
async function authorizeModerator(
  streamId: string,
  auth: WalletAuthArgs | undefined
): Promise<string> {
  const { address: actor } = await verifyWalletAuthArgs(auth);

  const supabase = createServiceClient();
  const stream = await lookupStream(streamId);
  if (stream?.creator_id && stream.creator_id.toLowerCase() === actor) {
    return actor;
  }

  const { data: mod, error: modErr } = await supabase
    .from("stream_moderation_moderators")
    .select("moderator_address")
    .eq("stream_id", streamId)
    .eq("moderator_address", actor)
    .maybeSingle();
  if (modErr) {
    throw new Error(`Failed to look up moderator: ${modErr.message}`);
  }
  if (!mod) {
    throw new WalletAuthError(403, "Not authorized to moderate this stream");
  }
  return actor;
}

/**
 * Stream creator only. Used by addModerator/removeModerator below.
 */
async function authorizeCreator(
  streamId: string,
  auth: WalletAuthArgs | undefined
): Promise<string> {
  const { address: actor } = await verifyWalletAuthArgs(auth);
  const stream = await lookupStream(streamId);
  if (!stream) throw new Error("Stream not found");
  if (stream.creator_id.toLowerCase() !== actor) {
    throw new WalletAuthError(403, "Only the stream creator can do this");
  }
  return actor;
}

/**
 * Fetch the full moderation state for a stream. Open to anonymous reads so
 * every chat client can apply the same view filter.
 */
export async function getModerationState(streamId: string): Promise<ModerationState> {
  const supabase = createServiceClient();

  const [hiddenRes, bansRes, modsRes] = await Promise.all([
    supabase
      .from("stream_moderation_hidden_messages")
      .select("message_id")
      .eq("stream_id", streamId),
    supabase
      .from("stream_moderation_bans")
      .select("banned_address")
      .eq("stream_id", streamId),
    supabase
      .from("stream_moderation_moderators")
      .select("moderator_address")
      .eq("stream_id", streamId),
  ]);

  if (hiddenRes.error) throw new Error(hiddenRes.error.message);
  if (bansRes.error) throw new Error(bansRes.error.message);
  if (modsRes.error) throw new Error(modsRes.error.message);

  return {
    hiddenIds: (hiddenRes.data || []).map((r) => r.message_id),
    bannedAddresses: (bansRes.data || []).map((r) => r.banned_address.toLowerCase()),
    moderators: (modsRes.data || []).map((r) => r.moderator_address.toLowerCase()),
  };
}

export async function hideMessage(
  streamId: string,
  messageId: string,
  auth: WalletAuthArgs
) {
  const actor = await authorizeModerator(streamId, auth);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("stream_moderation_hidden_messages")
    .upsert(
      {
        stream_id: streamId,
        message_id: messageId,
        hidden_by: actor,
      },
      { onConflict: "stream_id,message_id" }
    );
  if (error) throw new Error(error.message);
}

export async function unhideMessage(
  streamId: string,
  messageId: string,
  auth: WalletAuthArgs
) {
  await authorizeModerator(streamId, auth);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("stream_moderation_hidden_messages")
    .delete()
    .eq("stream_id", streamId)
    .eq("message_id", messageId);
  if (error) throw new Error(error.message);
}

export async function banUser(
  streamId: string,
  address: string,
  auth: WalletAuthArgs
) {
  const actor = await authorizeModerator(streamId, auth);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("stream_moderation_bans")
    .upsert(
      {
        stream_id: streamId,
        banned_address: address.toLowerCase(),
        banned_by: actor,
      },
      { onConflict: "stream_id,banned_address" }
    );
  if (error) throw new Error(error.message);
}

export async function unbanUser(
  streamId: string,
  address: string,
  auth: WalletAuthArgs
) {
  await authorizeModerator(streamId, auth);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("stream_moderation_bans")
    .delete()
    .eq("stream_id", streamId)
    .eq("banned_address", address.toLowerCase());
  if (error) throw new Error(error.message);
}

/**
 * Only the stream creator can appoint moderators. Existing moderators cannot
 * appoint new ones — this matches Twitch behaviour and keeps the trust model
 * simple.
 */
export async function addModerator(
  streamId: string,
  address: string,
  auth: WalletAuthArgs
) {
  const actor = await authorizeCreator(streamId, auth);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("stream_moderation_moderators")
    .upsert(
      {
        stream_id: streamId,
        moderator_address: address.toLowerCase(),
        appointed_by: actor,
      },
      { onConflict: "stream_id,moderator_address" }
    );
  if (error) throw new Error(error.message);
}

export async function removeModerator(
  streamId: string,
  address: string,
  auth: WalletAuthArgs
) {
  await authorizeCreator(streamId, auth);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("stream_moderation_moderators")
    .delete()
    .eq("stream_id", streamId)
    .eq("moderator_address", address.toLowerCase());
  if (error) throw new Error(error.message);
}

export async function listModerators(streamId: string): Promise<ModeratorRecord[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("stream_moderation_moderators")
    .select("moderator_address, appointed_by, appointed_at")
    .eq("stream_id", streamId)
    .order("appointed_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as ModeratorRecord[];
}

/**
 * Convenience: resolve the streamId for a given creator address. Used by the
 * host page when wiring up the moderation UI.
 */
export async function getStreamIdForCreator(creatorAddress: string) {
  const stream = await getStreamByCreator(creatorAddress);
  return stream?.stream_id ?? null;
}
