/* eslint-disable */
/**
 * Long-running XMTP moderation worker.
 *
 * Run as a separate process (Railway / Render / Fly / a dedicated VM). One
 * instance services all live streams: it joins every chat group it gets
 * invited to, persists every message to Supabase (so chat history survives
 * across sessions), and removes any sender whose address appears in the
 * `stream_moderation_bans` table.
 *
 * Why standalone? XMTP's `streamAllMessages` is a long-lived async iterator;
 * Vercel/Edge functions can't host that. The browser-side code in
 * `useLiveChatModerated` does the same persistence + kick when the host's
 * tab is open, but only this worker provides the always-on guarantee.
 *
 * --- Setup ---
 *
 * Required env vars:
 *   XMTP_MODERATION_BOT_PRIVATE_KEY   0x… EOA used as the bot's identity.
 *   XMTP_ENV                          "production" | "dev" (default production)
 *   NEXT_PUBLIC_SUPABASE_URL          same as the app
 *   SUPABASE_SERVICE_ROLE_KEY         service role key (bypasses RLS)
 *   STREAM_ID_RESOLVER_URL (optional) HTTPS endpoint that maps an XMTP group
 *                                     id to a stream id; falls back to the
 *                                     conversation id.
 *
 * Install (once, in a deploy package separate from the Next.js app):
 *   npm i @xmtp/node-sdk @supabase/supabase-js viem dotenv
 *
 * Run:
 *   tsx scripts/xmtp-moderation-worker.ts
 *
 * The host's browser is responsible for inviting the bot to each chat group;
 * see TODO in `lib/hooks/xmtp/useLiveChat.ts` for the invitation hook.
 */

// @ts-ignore - resolved at deploy time
import { Client, type Conversation, type DecodedMessage } from "@xmtp/node-sdk";
// @ts-ignore
import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import { privateKeyToAccount } from "viem/accounts";

type WorkerConfig = {
  privateKey: `0x${string}`;
  xmtpEnv: "production" | "dev";
  supabaseUrl: string;
  supabaseServiceKey: string;
};

function readConfig(): WorkerConfig {
  const privateKey = process.env.XMTP_MODERATION_BOT_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!privateKey || !privateKey.startsWith("0x")) {
    throw new Error("XMTP_MODERATION_BOT_PRIVATE_KEY missing or malformed");
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase env vars missing");
  }
  return {
    privateKey: privateKey as `0x${string}`,
    xmtpEnv: (process.env.XMTP_ENV as "production" | "dev") || "production",
    supabaseUrl,
    supabaseServiceKey,
  };
}

async function buildXmtpClient(config: WorkerConfig) {
  const account = privateKeyToAccount(config.privateKey);
  // The exact Client.create signature changes between minor versions of
  // @xmtp/node-sdk. The shape below matches v5.x; adapt if you upgrade.
  const client = await Client.create(
    {
      // signer
      type: "EOA",
      getIdentifier: () => ({ identifier: account.address, identifierKind: "Ethereum" }),
      signMessage: async (message: string) =>
        account.signMessage({ message }) as unknown as Uint8Array,
    } as any,
    { env: config.xmtpEnv } as any
  );
  await client.conversations.sync();
  return client;
}

type BanRow = { stream_id: string; banned_address: string };

class BanCache {
  private banned = new Map<string, Set<string>>();

  constructor(
    private supabase: ReturnType<typeof createClient>,
    private refreshIntervalMs = 15_000
  ) {}

  async start() {
    await this.refresh();
    setInterval(() => {
      this.refresh().catch((err) =>
        console.error("[BanCache] refresh failed:", err)
      );
    }, this.refreshIntervalMs);
  }

  async refresh() {
    const { data, error } = await this.supabase
      .from("stream_moderation_bans")
      .select("stream_id, banned_address");
    if (error) throw error;
    const next = new Map<string, Set<string>>();
    for (const row of (data || []) as BanRow[]) {
      const set = next.get(row.stream_id) ?? new Set<string>();
      set.add(row.banned_address.toLowerCase());
      next.set(row.stream_id, set);
    }
    this.banned = next;
  }

  isBanned(streamId: string, senderInboxId: string) {
    const set = this.banned.get(streamId);
    if (!set) return false;
    return set.has(senderInboxId.toLowerCase());
  }
}

/**
 * Map XMTP conversationId → streamId. Today the host's browser stores this
 * mapping in localStorage as `xmtp-live-group-live-${streamId}-${sessionId}`,
 * which the worker can't see. Two viable strategies:
 *   1) The host POSTs the mapping to a backend table on stream start
 *      (recommended; add a `stream_chat_groups` table).
 *   2) The bot accepts a special "register" message from the host containing
 *      the streamId; cache it in memory.
 *
 * For the scaffold we read from a `stream_chat_groups` table that you create
 * separately (or fall back to the conversation id, which makes bans key on
 * group id rather than playback id — a reasonable degraded mode).
 */
async function resolveStreamId(
  supabase: ReturnType<typeof createClient>,
  conversationId: string
): Promise<string> {
  const { data } = await supabase
    .from("stream_chat_groups")
    .select("stream_id")
    .eq("group_id", conversationId)
    .maybeSingle();
  return (data?.stream_id as string) || conversationId;
}

async function persistMessage(
  supabase: ReturnType<typeof createClient>,
  streamId: string,
  message: DecodedMessage<any>
) {
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);
  const sentAt = new Date(Number(message.sentAtNs / BigInt(1_000_000)));

  const { error } = await supabase.from("stream_chat_messages").upsert(
    {
      stream_id: streamId,
      message_id: message.id,
      sender_inbox_id: message.senderInboxId,
      content,
      sent_at: sentAt.toISOString(),
      message_type: "text",
    },
    { onConflict: "stream_id,message_id", ignoreDuplicates: true }
  );

  if (error) console.error("[persist] failed:", error.message);
}

async function maybeKick(
  conversation: Conversation<any>,
  senderInboxId: string,
  client: any
) {
  // Don't try to kick ourselves.
  if (senderInboxId === client.inboxId) return;
  try {
    // @ts-ignore — node-sdk and browser-sdk share the same name.
    await conversation.removeMembers([senderInboxId]);
    console.log("[kick] removed", senderInboxId, "from", conversation.id);
  } catch (err) {
    // Most common cause: the bot wasn't promoted to admin. Surface so the
    // host can fix the role.
    console.warn("[kick] failed; bot likely lacks admin rights:", err);
  }
}

async function main() {
  const config = readConfig();
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const bans = new BanCache(supabase);
  await bans.start();

  console.log("[xmtp-mod-worker] starting client…");
  const client = await buildXmtpClient(config);
  console.log("[xmtp-mod-worker] inboxId:", client.inboxId);

  // Stream all incoming messages from every group the bot is a member of.
  const stream = await (client as any).conversations.streamAllMessages();
  for await (const message of stream) {
    try {
      const conversationId = message.conversationId;
      const streamId = await resolveStreamId(supabase, conversationId);

      // 1) Persist every message — idempotent on (stream_id, message_id).
      await persistMessage(supabase, streamId, message);

      // 2) Enforce ban: kick the sender if they appear in the ban list.
      if (bans.isBanned(streamId, message.senderInboxId)) {
        const conversation = await (client as any).conversations.getConversationById(
          conversationId
        );
        if (conversation) {
          await maybeKick(conversation, message.senderInboxId, client);
        }
      }
    } catch (err) {
      console.error("[loop] error processing message:", err);
    }
  }
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
