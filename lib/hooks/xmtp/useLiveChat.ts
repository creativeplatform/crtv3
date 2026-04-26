"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Client, Group, Message, DecodedMessage } from "@xmtp/browser-sdk";
import { ConsentState } from "@xmtp/browser-sdk";
import { useUser } from "@account-kit/react";
import { useXmtpClient } from "./useXmtpClient";
import { parseTipMessage } from "@/lib/utils/video-tip";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { logger } from '@/lib/utils/logger';


export interface LiveChatMessage {
  id: string;
  content: string;
  senderAddress: string;
  sentAt: Date;
  type?: 'text' | 'tip';
  tipData?: {
    amount: string;
    token: 'ETH' | 'USDC' | 'DAI';
    txHash: string;
  };
}

export interface UseLiveChatReturn {
  messages: LiveChatMessage[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  sendTipMessage: (amount: string, token: 'ETH' | 'USDC' | 'DAI', txHash: string) => Promise<void>;
  isSending: boolean;
  viewerCount?: number; // Optional: can be provided from stream stats
  /** XMTP group reference. Exposed for moderation actions (e.g. removing a banned member). */
  group: Group | null;
  /** Hydrate the in-memory message list (used for catch-up loading from history). */
  prependMessages: (msgs: LiveChatMessage[]) => void;
}

export interface UseLiveChatOptions {
  maxMessages?: number;
  messageRetentionMs?: number;
  rateLimit?: { count: number; windowMs: number };
  /**
   * Called for every message the hook observes (initial load + streamed).
   * Best-effort fan-out target for persistence; thrown errors are swallowed.
   */
  onMessageObserved?: (msg: LiveChatMessage) => void;
}

// Production-safe logging
const isDev = process.env.NODE_ENV === 'development';
const log = (...args: any[]) => {
  if (isDev) logger.debug(...args);
};
const logError = (...args: any[]) => {
  logger.error(...args);
};
const logWarn = (...args: any[]) => {
  if (isDev) logger.warn(...args);
};

/**
 * Hook for live stream chat functionality
 * 
 * Optimized for real-time, high-volume chat during livestreams
 * Features:
 * - Session-based groups (one per stream session)
 * - Message rate limiting
 * - Auto-cleanup of old messages
 * - Optimized for performance
 */
export function useLiveChat(
  streamId: string,
  sessionId: string,
  options?: UseLiveChatOptions
): UseLiveChatReturn {
  const { client, isLoading: isClientLoading, isConnected, error: clientError } = useXmtpClient();
  const user = useUser();
  const { address: smartAccountAddress } = useModularAccount();
  const walletAddress = smartAccountAddress || user?.address || null;
  
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const streamRef = useRef<AsyncIterable<DecodedMessage<any>> | null>(null);
  const isStreamingRef = useRef(false);
  const seenMessageIds = useRef(new Set<string>());

  // Keep observer callback in a ref so the streaming effect doesn't restart
  // when the caller passes a new function instance every render.
  const onMessageObservedRef = useRef(options?.onMessageObserved);
  useEffect(() => {
    onMessageObservedRef.current = options?.onMessageObserved;
  }, [options?.onMessageObserved]);

  // Rate limiting
  const rateLimit = options?.rateLimit || { count: 5, windowMs: 10000 }; // 5 messages per 10 seconds
  const messageTimestamps = useRef<number[]>([]);
  
  // Message retention
  const maxMessages = options?.maxMessages || 200;
  const messageRetentionMs = options?.messageRetentionMs || 10 * 60 * 1000; // 10 minutes

  // Propagate client errors
  useEffect(() => {
    if (clientError) {
      logError("useLiveChat: XMTP client error detected:", clientError);
      setError(clientError);
    }
  }, [clientError]);

  // Create session-based group for this live stream
  const initializeGroup = useCallback(async () => {
    if (!client || !isConnected || !streamId || !sessionId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use session-based group ID for live streams
      const groupId = `live-${streamId}-${sessionId}`;
      const storageKey = `xmtp-live-group-${groupId}`;
      const storedGroupId = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;

      let targetGroup: Group | null = null;

      if (storedGroupId) {
        // Try to find the group by ID
        const allGroups = await client.conversations.listGroups({
          consentStates: [ConsentState.Allowed],
        });
        
        targetGroup = allGroups.find((g) => g.id === storedGroupId) || null;
      }

      // If group not found, create a new one for this session
      if (!targetGroup) {
        const currentUserInboxId = client.inboxId;
        if (!currentUserInboxId) {
          throw new Error("Client inbox ID is not available");
        }
        targetGroup = await client.conversations.newGroup([currentUserInboxId]);
        
        // Store the group ID for this session
        if (typeof window !== "undefined" && targetGroup.id) {
          localStorage.setItem(storageKey, targetGroup.id);
        }
      }
      
      setGroup(targetGroup);
      
      // For live streams, only load recent messages (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existingMessages = await targetGroup.messages();
      
      // Convert sentAtNs (nanoseconds) to Date for comparison
      const recentMessages = existingMessages.filter((msg) => {
        const sentAt = new Date(Number(msg.sentAtNs / BigInt(1_000_000)));
        return sentAt >= fiveMinutesAgo;
      });
      
      log("Loaded recent messages for live stream:", recentMessages.length);
      
      const formattedMessages: LiveChatMessage[] = recentMessages
        .slice(-maxMessages) // Only keep most recent messages
        .map((msg) => {
          const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          const tipData = parseTipMessage(content);
          // Convert sentAtNs (nanoseconds) to Date
          const sentAt = new Date(Number(msg.sentAtNs / BigInt(1_000_000)));
          
          return {
            id: msg.id,
            content,
            senderAddress: msg.senderInboxId,
            sentAt,
            type: tipData ? 'tip' : 'text',
            tipData: tipData || undefined,
          };
        });
      
      formattedMessages.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

      // Populate dedup Set with initial message IDs
      seenMessageIds.current.clear();
      formattedMessages.forEach(msg => seenMessageIds.current.add(msg.id));

      setMessages(formattedMessages);
      setError(null);

      // Best-effort: notify observer of every message we know about so far.
      const cb = onMessageObservedRef.current;
      if (cb) {
        for (const m of formattedMessages) {
          try {
            cb(m);
          } catch (e) {
            logWarn("onMessageObserved threw during initial load:", e);
          }
        }
      }

      log("useLiveChat: Group initialization successful", {
        groupId: targetGroup.id,
        messageCount: formattedMessages.length,
      });
    } catch (err) {
      logError("Error initializing live chat group:", err);
      setError(err instanceof Error ? err : new Error("Failed to initialize live chat"));
    } finally {
      setIsLoading(false);
    }
  }, [client, isConnected, streamId, sessionId, maxMessages]);

  // Initialize group when client is ready
  useEffect(() => {
    log("useLiveChat: Checking initialization conditions", {
      isClientLoading,
      isConnected,
      hasClient: !!client,
      streamId,
      sessionId,
    });
    
    if (!isClientLoading && isConnected && client) {
      log("useLiveChat: Starting group initialization");
      initializeGroup();
    }
  }, [isClientLoading, isConnected, client, initializeGroup, streamId, sessionId]);

  // Auto-cleanup old messages for live streams
  useEffect(() => {
    if (!group) return;
    
    const cleanup = setInterval(() => {
      const cutoffTime = Date.now() - messageRetentionMs;
      setMessages((prev) => {
        const filtered = prev.filter(msg => msg.sentAt.getTime() > cutoffTime);
        const trimmed = filtered.slice(-maxMessages);
        // Rebuild dedup Set to match retained messages
        seenMessageIds.current = new Set(trimmed.map(msg => msg.id));
        return trimmed;
      });
    }, 30000); // Cleanup every 30 seconds
    
    return () => clearInterval(cleanup);
  }, [group, messageRetentionMs, maxMessages]);

  // Stream messages in real-time
  useEffect(() => {
    if (!client || !group || isStreamingRef.current) {
      return;
    }

    const startStreaming = async () => {
      try {
        isStreamingRef.current = true;
        const groupId = group.id;
        
        log("Starting live message stream for group:", groupId);
        
        const stream = await client.conversations.streamAllGroupMessages({
          consentStates: [ConsentState.Allowed],
        });

        streamRef.current = stream;

        for await (const message of stream) {
          if (message.conversationId === groupId) {
            const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
            const tipData = parseTipMessage(content);
            // Convert sentAtNs (nanoseconds) to Date
            const sentAt = new Date(Number(message.sentAtNs / BigInt(1_000_000)));
            
            const newMessage: LiveChatMessage = {
              id: message.id,
              content,
              senderAddress: message.senderInboxId,
              sentAt,
              type: tipData ? 'tip' : 'text',
              tipData: tipData || undefined,
            };

            let isNew = false;
            setMessages((prev) => {
              // O(1) dedup check using Set
              if (seenMessageIds.current.has(newMessage.id)) {
                return prev;
              }
              seenMessageIds.current.add(newMessage.id);
              isNew = true;

              // Append directly — messages arrive chronologically from XMTP.
              // Retention cleanup is handled by the periodic 30s interval.
              const updated = [...prev, newMessage].slice(-maxMessages);
              return updated;
            });

            if (isNew) {
              const cb = onMessageObservedRef.current;
              if (cb) {
                try {
                  cb(newMessage);
                } catch (e) {
                  logWarn("onMessageObserved threw during stream:", e);
                }
              }
            }
          }
        }
      } catch (err) {
        logError("Error streaming live messages:", err);
        setError(err instanceof Error ? err : new Error("Failed to stream messages"));
        isStreamingRef.current = false;
      }
    };

    startStreaming();

    return () => {
      isStreamingRef.current = false;
      streamRef.current = null;
    };
  }, [client, group, messageRetentionMs, maxMessages]);

  // Check rate limit
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const windowStart = now - rateLimit.windowMs;
    
    // Remove old timestamps
    messageTimestamps.current = messageTimestamps.current.filter(
      time => time > windowStart
    );
    
    // Check if limit exceeded
    if (messageTimestamps.current.length >= rateLimit.count) {
      return false;
    }
    
    // Add current timestamp
    messageTimestamps.current.push(now);
    return true;
  }, [rateLimit]);

  // Send message to group
  const sendMessage = useCallback(
    async (content: string) => {
      if (!client || !isConnected || !group || !content.trim() || !walletAddress) {
        if (!group) {
          logWarn("Cannot send message: Group not initialized");
          setError(new Error("Chat is initializing. Please wait a moment."));
        }
        return;
      }

      // Check rate limit
      if (!checkRateLimit()) {
        const errorMsg = `Rate limit exceeded. Please wait ${Math.ceil(rateLimit.windowMs / 1000)} seconds before sending another message.`;
        setError(new Error(errorMsg));
        return;
      }

      setIsSending(true);
      setError(null);

      const trimmedContent = content.trim();
      
      // Optimistically add the message
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticMessage: LiveChatMessage = {
        id: tempId,
        content: trimmedContent,
        senderAddress: walletAddress,
        sentAt: new Date(),
        type: 'text',
      };

      setMessages((prev) => {
        const updated = [...prev, optimisticMessage]
          .slice(-maxMessages)
          .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
        return updated;
      });

      try {
        const sentMessageId = await group.send(trimmedContent);
        
        // Update optimistic message with real ID
        if (sentMessageId && sentMessageId !== tempId) {
          setMessages((prev) => {
            return prev.map((msg) => 
              msg.id === tempId ? { ...msg, id: sentMessageId } : msg
            );
          });
        }
      } catch (err) {
        logError("Error sending message:", err);
        
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        
        setError(err instanceof Error ? err : new Error("Failed to send message"));
      } finally {
        setIsSending(false);
      }
    },
    [group, client, walletAddress, isConnected, checkRateLimit, rateLimit, maxMessages]
  );

  // Send tip message
  const sendTipMessage = useCallback(
    async (amount: string, token: 'ETH' | 'USDC' | 'DAI', txHash: string) => {
      if (!group || !walletAddress) {
        return;
      }

      setIsSending(true);
      setError(null);

      try {
        const tipMessage = JSON.stringify({
          type: 'tip',
          amount,
          token,
          txHash,
        });

        const sentMessageId = await group.send(tipMessage);
        
        const optimisticMessage: LiveChatMessage = {
          id: sentMessageId || `tip-temp-${Date.now()}-${Math.random()}`,
          content: tipMessage,
          senderAddress: walletAddress,
          sentAt: new Date(),
          type: 'tip',
          tipData: { amount, token, txHash },
        };

        setMessages((prev) => {
          const updated = [...prev, optimisticMessage]
            .slice(-maxMessages)
            .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
          return updated;
        });
      } catch (err) {
        logError("Error sending tip message:", err);
        setError(err instanceof Error ? err : new Error("Failed to send tip message"));
      } finally {
        setIsSending(false);
      }
    },
    [group, walletAddress, maxMessages]
  );

  // Splice older messages (e.g. from server-side history) ahead of whatever
  // we already have. Dedupes on message id; preserves chronological order.
  const prependMessages = useCallback((older: LiveChatMessage[]) => {
    if (older.length === 0) return;
    setMessages((prev) => {
      const merged: LiveChatMessage[] = [];
      const seen = new Set<string>();
      for (const m of older) {
        if (seenMessageIds.current.has(m.id) || seen.has(m.id)) continue;
        seen.add(m.id);
        merged.push(m);
      }
      if (merged.length === 0) return prev;
      merged.forEach(m => seenMessageIds.current.add(m.id));
      return [...merged, ...prev]
        .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
        .slice(-maxMessages);
    });
  }, [maxMessages]);

  return {
    messages,
    isLoading: isLoading || isClientLoading,
    error,
    sendMessage,
    sendTipMessage,
    isSending,
    group,
    prependMessages,
  };
}


