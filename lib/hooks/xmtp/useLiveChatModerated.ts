"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@account-kit/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { useLiveChat, type UseLiveChatReturn, type LiveChatMessage } from "./useLiveChat";
import {
  addModerator as addModeratorAction,
  banUser as banUserAction,
  getModerationState,
  hideMessage as hideMessageAction,
  removeModerator as removeModeratorAction,
  unbanUser as unbanUserAction,
  unhideMessage as unhideMessageAction,
  type ModerationState,
} from "@/services/stream-moderation";
import {
  listChatHistory,
  recordChatMessage,
  type StoredChatMessage,
} from "@/services/stream-chat-history";
import { registerChatGroup } from "@/services/stream-chat-groups";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { logger } from "@/lib/utils/logger";

interface AuthHeaders {
  "X-Wallet-Address": string;
  "X-Wallet-Timestamp": string;
  "X-Wallet-Signature": string;
}

function headersToAuthArgs(headers: AuthHeaders) {
  return {
    address: headers["X-Wallet-Address"],
    timestamp: Number(headers["X-Wallet-Timestamp"]),
    signature: headers["X-Wallet-Signature"],
  };
}

const MODERATION_BOT_INBOX_ID =
  process.env.NEXT_PUBLIC_MODERATION_BOT_INBOX_ID?.trim() || "";

const MODERATION_POLL_MS = 10_000;
const HISTORY_LIMIT = 100;

function storedToLiveMessage(stored: StoredChatMessage): LiveChatMessage {
  return {
    id: stored.message_id,
    content: stored.content,
    senderAddress: stored.sender_inbox_id,
    sentAt: new Date(stored.sent_at),
    type: stored.message_type === "tip" ? "tip" : "text",
    tipData: stored.tip_data ?? undefined,
  };
}

export interface UseLiveChatModeratedReturn extends UseLiveChatReturn {
  isModerator: boolean;
  isCreator: boolean;
  canModerate: boolean;
  moderationState: ModerationState;
  moderationError: Error | null;
  refreshModeration: () => Promise<void>;
  hideMessage: (messageId: string) => Promise<void>;
  unhideMessage: (messageId: string) => Promise<void>;
  banUser: (address: string) => Promise<void>;
  unbanUser: (address: string) => Promise<void>;
  addModerator: (address: string) => Promise<void>;
  removeModerator: (address: string) => Promise<void>;
}

export interface UseLiveChatModeratedOptions {
  maxMessages?: number;
  messageRetentionMs?: number;
  rateLimit?: { count: number; windowMs: number };
  /** Address of the stream creator. */
  creatorAddress?: string | null;
  /** Whether to enable moderation features. Defaults to true. */
  enabled?: boolean;
}

const EMPTY_STATE: ModerationState = {
  hiddenIds: [],
  bannedAddresses: [],
  moderators: [],
};

/**
 * Wraps `useLiveChat` with a moderation overlay backed by Supabase.
 *
 * - Reads `getModerationState` on a 10s poll plus an immediate refresh after
 *   any local mutation, so changes propagate to all viewers within ~10s.
 * - Filters messages by hidden IDs and banned senderAddresses (XMTP inbox IDs).
 * - Exposes mutation helpers that delegate to the server actions, which enforce
 *   creator-or-moderator authorization.
 */
export function useLiveChatModerated(
  streamId: string,
  sessionId: string,
  options: UseLiveChatModeratedOptions = {}
): UseLiveChatModeratedReturn {
  const { creatorAddress, enabled = true, ...liveChatOptions } = options;
  const { getAuthHeaders, isReady: walletAuthReady } = useWalletAuth();

  // Persist every observed message to Supabase so history survives even when
  // no server-side worker is running. The server worker (scripts/xmtp-
  // moderation-worker.ts) does the same thing from a long-lived process; both
  // calls are idempotent on (stream_id, message_id).
  //
  // Persistence requires a wallet signature (server enforces this in
  // recordChatMessage). The viewer's cached signature unlocks every message
  // for the next ~4 minutes, so the prompt only fires once per session.
  const persistObserved = useCallback(
    (msg: LiveChatMessage) => {
      if (!enabled || !streamId || !walletAuthReady) return;
      (async () => {
        try {
          const headers = await getAuthHeaders();
          await recordChatMessage(
            {
              streamId,
              messageId: msg.id,
              senderInboxId: msg.senderAddress,
              content: msg.content,
              sentAt: msg.sentAt,
              messageType: msg.type === "tip" ? "tip" : "text",
              tipData: msg.tipData ?? null,
            },
            headersToAuthArgs(headers as AuthHeaders)
          );
        } catch (err) {
          // Best-effort: log and move on. The long-lived worker will catch
          // any messages we miss here.
          logger.warn("Failed to persist chat message:", err);
        }
      })();
    },
    [enabled, streamId, walletAuthReady, getAuthHeaders]
  );

  const base = useLiveChat(streamId, sessionId, {
    ...liveChatOptions,
    onMessageObserved: persistObserved,
  });

  const user = useUser();
  const { address: smartAccountAddress } = useModularAccount();
  const actorAddress = (smartAccountAddress || user?.address || null)?.toLowerCase() || null;

  const [state, setState] = useState<ModerationState>(EMPTY_STATE);
  const [moderationError, setModerationError] = useState<Error | null>(null);
  const stopped = useRef(false);
  const historyLoaded = useRef(false);
  const botProvisioned = useRef<string | null>(null);

  // One-shot: load older messages from Supabase once XMTP is initialized so
  // late joiners see context (XMTP's initial fetch is capped at ~5 minutes).
  useEffect(() => {
    if (!enabled || !streamId || historyLoaded.current) return;
    if (base.isLoading || !base.group) return;
    historyLoaded.current = true;
    (async () => {
      try {
        const history = await listChatHistory(streamId, { limit: HISTORY_LIMIT });
        if (history.length > 0) {
          base.prependMessages(history.map(storedToLiveMessage));
        }
      } catch (err) {
        logger.warn("Failed to load chat history:", err);
      }
    })();
  }, [enabled, streamId, base.isLoading, base.group, base.prependMessages]);

  const refresh = useCallback(async () => {
    if (!enabled || !streamId) return;
    try {
      const next = await getModerationState(streamId);
      if (!stopped.current) {
        setState(next);
        setModerationError(null);
      }
    } catch (err) {
      logger.error("Failed to fetch moderation state:", err);
      if (!stopped.current) {
        setModerationError(err instanceof Error ? err : new Error("Moderation fetch failed"));
      }
    }
  }, [enabled, streamId]);

  useEffect(() => {
    stopped.current = false;
    if (!enabled || !streamId) return;
    refresh();
    const interval = setInterval(refresh, MODERATION_POLL_MS);
    return () => {
      stopped.current = true;
      clearInterval(interval);
    };
  }, [enabled, streamId, refresh]);

  const isCreator = useMemo(() => {
    if (!creatorAddress || !actorAddress) return false;
    return creatorAddress.toLowerCase() === actorAddress;
  }, [creatorAddress, actorAddress]);

  const isModerator = useMemo(() => {
    if (!actorAddress) return false;
    return state.moderators.includes(actorAddress);
  }, [state.moderators, actorAddress]);

  const canModerate = isCreator || isModerator;

  // Once-per-group: from the host's browser, invite the moderation bot to
  // the XMTP group, promote it to admin (so it can kick banned members),
  // and register the (groupId → streamId) mapping the worker needs to
  // resolve conversations. All three steps are idempotent and best-effort:
  // if the bot inbox isn't configured we just skip silently and leave the
  // browser fallback to handle moderation while the host's tab is open.
  useEffect(() => {
    if (!enabled || !streamId || !isCreator) return;
    const group = base.group;
    if (!group) return;
    if (botProvisioned.current === group.id) return;
    // Optimistically lock so we don't race; we'll reset on hard failure.
    botProvisioned.current = group.id;

    (async () => {
      const tasks: Array<Promise<void>> = [];

      // 1) Bot membership + admin role.
      if (MODERATION_BOT_INBOX_ID) {
        tasks.push(
          (async () => {
            try {
              const botId = MODERATION_BOT_INBOX_ID;
              const members = await group.members();
              const alreadyMember = members.some(
                (m) => m.inboxId.toLowerCase() === botId.toLowerCase()
              );
              if (!alreadyMember) {
                await group.addMembers([botId]);
              }
              const adminCheck = group.isAdmin(botId);
              const isBotAdmin =
                typeof adminCheck === "boolean" ? adminCheck : await adminCheck;
              if (!isBotAdmin) {
                await group.addAdmin(botId);
              }
            } catch (err) {
              logger.warn("Failed to invite moderation bot:", err);
            }
          })()
        );
      }

      // 2) groupId → streamId mapping for the worker. Requires a wallet
      // signature so the server can verify the caller is the stream's
      // creator before accepting the mapping.
      tasks.push(
        (async () => {
          try {
            const headers = await getAuthHeaders();
            await registerChatGroup(
              streamId,
              group.id,
              headersToAuthArgs(headers as AuthHeaders),
              MODERATION_BOT_INBOX_ID ? new Date() : null
            );
          } catch (err) {
            logger.warn("Failed to register chat group mapping:", err);
          }
        })()
      );

      await Promise.all(tasks);
    })();
  }, [enabled, streamId, isCreator, base.group, getAuthHeaders]);

  const filteredMessages = useMemo<LiveChatMessage[]>(() => {
    if (!enabled) return base.messages;
    if (state.hiddenIds.length === 0 && state.bannedAddresses.length === 0) {
      return base.messages;
    }
    const hiddenSet = new Set(state.hiddenIds);
    const bannedSet = new Set(state.bannedAddresses);
    return base.messages.filter((msg) => {
      if (hiddenSet.has(msg.id)) return false;
      if (msg.senderAddress && bannedSet.has(msg.senderAddress.toLowerCase())) return false;
      return true;
    });
  }, [base.messages, state, enabled]);

  const requireAuth = useCallback(async () => {
    if (!actorAddress) {
      throw new Error("Connect your wallet to moderate");
    }
    const headers = await getAuthHeaders();
    return headersToAuthArgs(headers as AuthHeaders);
  }, [actorAddress, getAuthHeaders]);

  const hideMessage = useCallback(
    async (messageId: string) => {
      const auth = await requireAuth();
      await hideMessageAction(streamId, messageId, auth);
      // Optimistic add so the UI updates immediately.
      setState((prev) =>
        prev.hiddenIds.includes(messageId)
          ? prev
          : { ...prev, hiddenIds: [...prev.hiddenIds, messageId] }
      );
      refresh();
    },
    [streamId, requireAuth, refresh]
  );

  const unhideMessage = useCallback(
    async (messageId: string) => {
      const auth = await requireAuth();
      await unhideMessageAction(streamId, messageId, auth);
      setState((prev) => ({
        ...prev,
        hiddenIds: prev.hiddenIds.filter((id) => id !== messageId),
      }));
      refresh();
    },
    [streamId, requireAuth, refresh]
  );

  const banUser = useCallback(
    async (address: string) => {
      const auth = await requireAuth();
      const lower = address.toLowerCase();
      await banUserAction(streamId, lower, auth);
      setState((prev) =>
        prev.bannedAddresses.includes(lower)
          ? prev
          : { ...prev, bannedAddresses: [...prev.bannedAddresses, lower] }
      );
      // Best-effort hard kick: removes the banned member from the XMTP group
      // when the actor's client has admin rights (the host who created the
      // group always does). Falls through silently otherwise — the long-lived
      // server worker is the always-on guarantor; this branch just shortens
      // the propagation delay when the host is online.
      const group = base.group;
      if (group) {
        try {
          await group.removeMembers([lower]);
        } catch (err) {
          logger.debug("Could not remove member from XMTP group (likely not admin):", err);
        }
      }
      refresh();
    },
    [streamId, requireAuth, refresh, base.group]
  );

  const unbanUser = useCallback(
    async (address: string) => {
      const auth = await requireAuth();
      const lower = address.toLowerCase();
      await unbanUserAction(streamId, lower, auth);
      setState((prev) => ({
        ...prev,
        bannedAddresses: prev.bannedAddresses.filter((a) => a !== lower),
      }));
      refresh();
    },
    [streamId, requireAuth, refresh]
  );

  const addModerator = useCallback(
    async (address: string) => {
      const auth = await requireAuth();
      await addModeratorAction(streamId, address, auth);
      const lower = address.toLowerCase();
      setState((prev) =>
        prev.moderators.includes(lower)
          ? prev
          : { ...prev, moderators: [...prev.moderators, lower] }
      );
      refresh();
    },
    [streamId, requireAuth, refresh]
  );

  const removeModerator = useCallback(
    async (address: string) => {
      const auth = await requireAuth();
      await removeModeratorAction(streamId, address, auth);
      const lower = address.toLowerCase();
      setState((prev) => ({
        ...prev,
        moderators: prev.moderators.filter((m) => m !== lower),
      }));
      refresh();
    },
    [streamId, requireAuth, refresh]
  );

  return {
    ...base,
    messages: filteredMessages,
    isModerator,
    isCreator,
    canModerate,
    moderationState: state,
    moderationError,
    refreshModeration: refresh,
    hideMessage,
    unhideMessage,
    banUser,
    unbanUser,
    addModerator,
    removeModerator,
  };
}
