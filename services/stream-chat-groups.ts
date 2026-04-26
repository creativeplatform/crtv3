"use server";

import { createServiceClient } from "../lib/sdk/supabase/service";
import {
  verifyWalletAuthArgs,
  WalletAuthError,
  type WalletAuthArgs,
} from "../lib/auth/require-wallet";

export interface ChatGroupRecord {
  group_id: string;
  stream_id: string;
  bot_invited_at: string | null;
  created_at: string;
}

/**
 * Upsert the XMTP groupId → streamId mapping the moderation worker uses to
 * resolve a conversation back to a moderation key. Idempotent.
 *
 * Authorization: only the stream's creator can register a (groupId, streamId)
 * mapping. Without this, an attacker could remap any stream's group id to
 * point at a stream they control and hijack moderation reads.
 */
export async function registerChatGroup(
  streamId: string,
  groupId: string,
  auth: WalletAuthArgs,
  botInvitedAt?: Date | null
): Promise<ChatGroupRecord> {
  if (!streamId || !groupId) {
    throw new Error("streamId and groupId are required");
  }

  const { address: caller } = await verifyWalletAuthArgs(auth);

  const supabase = createServiceClient();

  // Resolve creator from playback_id first (matches the moderation key
  // convention), falling back to stream_id.
  let creatorId: string | null = null;
  {
    const { data: byPlayback, error: pbErr } = await supabase
      .from("streams")
      .select("creator_id")
      .eq("playback_id", streamId)
      .maybeSingle();
    if (pbErr) throw new Error(pbErr.message);
    if (byPlayback?.creator_id) {
      creatorId = byPlayback.creator_id;
    } else {
      const { data: byStream, error: sErr } = await supabase
        .from("streams")
        .select("creator_id")
        .eq("stream_id", streamId)
        .maybeSingle();
      if (sErr) throw new Error(sErr.message);
      creatorId = byStream?.creator_id ?? null;
    }
  }

  if (!creatorId) throw new Error("Stream not found");
  if (creatorId.toLowerCase() !== caller) {
    throw new WalletAuthError(
      403,
      "Only the stream creator can register the chat group mapping"
    );
  }

  const { data, error } = await supabase
    .from("stream_chat_groups")
    .upsert(
      {
        group_id: groupId,
        stream_id: streamId,
        bot_invited_at: botInvitedAt ? botInvitedAt.toISOString() : null,
      },
      { onConflict: "group_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to register chat group: ${error.message}`);
  }
  return data as ChatGroupRecord;
}

export async function getChatGroupByGroupId(
  groupId: string
): Promise<ChatGroupRecord | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("stream_chat_groups")
    .select("group_id, stream_id, bot_invited_at, created_at")
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ChatGroupRecord) ?? null;
}
