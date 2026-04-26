"use server";

import { createServiceClient } from "../lib/sdk/supabase/service";
import {
  verifyWalletAuthArgs,
  type WalletAuthArgs,
} from "../lib/auth/require-wallet";

export interface StoredChatMessage {
  stream_id: string;
  message_id: string;
  sender_inbox_id: string;
  content: string;
  sent_at: string;
  message_type: "text" | "tip";
  tip_data?: {
    amount: string;
    token: "ETH" | "USDC" | "DAI";
    txHash: string;
  } | null;
}

export interface RecordChatMessageInput {
  streamId: string;
  messageId: string;
  senderInboxId: string;
  content: string;
  sentAt: Date | string;
  messageType?: "text" | "tip";
  tipData?: StoredChatMessage["tip_data"];
}

/**
 * Insert (or no-op on conflict) a single chat message. Idempotent so the
 * client and the server worker can both call it safely.
 *
 * Authorization: any authenticated wallet may record messages — the chat
 * itself is open to any XMTP client that knows the group, so requiring more
 * than "you can sign for *some* address" would be theatre. The signature
 * gate prevents anonymous spam but doesn't try to verify XMTP membership.
 * For stronger guarantees, the long-lived moderation worker (which runs as
 * the platform bot inside each group) is the canonical writer.
 */
export async function recordChatMessage(
  input: RecordChatMessageInput,
  auth: WalletAuthArgs
) {
  await verifyWalletAuthArgs(auth);
  const supabase = createServiceClient();
  const sentAt =
    typeof input.sentAt === "string" ? input.sentAt : input.sentAt.toISOString();

  const { error } = await supabase.from("stream_chat_messages").upsert(
    {
      stream_id: input.streamId,
      message_id: input.messageId,
      sender_inbox_id: input.senderInboxId,
      content: input.content,
      sent_at: sentAt,
      message_type: input.messageType ?? "text",
      tip_data: input.tipData ?? null,
    },
    { onConflict: "stream_id,message_id", ignoreDuplicates: true }
  );

  if (error) {
    throw new Error(`Failed to record chat message: ${error.message}`);
  }
}

export async function recordChatMessages(
  inputs: RecordChatMessageInput[],
  auth: WalletAuthArgs
) {
  if (inputs.length === 0) return;
  await verifyWalletAuthArgs(auth);
  const supabase = createServiceClient();

  const rows = inputs.map((input) => ({
    stream_id: input.streamId,
    message_id: input.messageId,
    sender_inbox_id: input.senderInboxId,
    content: input.content,
    sent_at:
      typeof input.sentAt === "string" ? input.sentAt : input.sentAt.toISOString(),
    message_type: input.messageType ?? "text",
    tip_data: input.tipData ?? null,
  }));

  const { error } = await supabase
    .from("stream_chat_messages")
    .upsert(rows, { onConflict: "stream_id,message_id", ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to record chat messages: ${error.message}`);
  }
}

/**
 * Load chat history for a stream. Used at chat mount time to render messages
 * older than the XMTP "recent messages" window, and after a worker-side
 * pruning event. Read is intentionally unauthenticated to match the public
 * RLS policy on the table.
 */
export async function listChatHistory(
  streamId: string,
  options: {
    limit?: number;
    /** ISO timestamp; only messages strictly before this time are returned. */
    beforeSentAt?: string | null;
  } = {}
): Promise<StoredChatMessage[]> {
  const supabase = createServiceClient();
  const limit = Math.max(1, Math.min(500, options.limit ?? 200));

  let query = supabase
    .from("stream_chat_messages")
    .select("stream_id, message_id, sender_inbox_id, content, sent_at, message_type, tip_data")
    .eq("stream_id", streamId)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (options.beforeSentAt) {
    query = query.lt("sent_at", options.beforeSentAt);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load chat history: ${error.message}`);
  }

  // Caller wants chronological order; the query is reversed for "latest N".
  return ((data || []) as StoredChatMessage[]).reverse();
}
