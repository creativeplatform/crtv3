"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Client, Group, Message, DecodedMessage } from "@xmtp/browser-sdk";
import { ConsentState } from "@xmtp/browser-sdk";
import { useUser } from "@/lib/wallet/react";
import { useXmtpClient } from "./useXmtpClient";
import { parseTipMessage } from "@/lib/utils/video-tip";
import { TokenSymbol } from "@/lib/hooks/video/useVideoTip";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { logger } from '@/lib/utils/logger';


// Production-safe logging utility
const isDev = process.env.NODE_ENV === 'development';
const log = (...args: any[]) => {
  if (isDev) logger.debug(...args);
};
const logError = (...args: any[]) => {
  // Always log errors, but can be enhanced with error tracking service
  logger.error(...args);
};
const logWarn = (...args: any[]) => {
  if (isDev) logger.warn(...args);
};

export interface VideoChatMessage {
  id: string;
  content: string;
  senderAddress: string;
  sentAt: Date;
  type?: 'text' | 'tip';
  tipData?: {
    amount: string;
    token: TokenSymbol;
    txHash: string;
  };
}

export interface UseVideoChatReturn {
  messages: VideoChatMessage[];
  isLoading: boolean;
  error: Error | null;
  group: Group | null;
  sendMessage: (content: string) => Promise<void>;
  sendTipMessage: (amount: string, token: TokenSymbol, txHash: string) => Promise<void>;
  isSending: boolean;
}

/**
 * Hook for video-specific group chat functionality
 * 
 * Creates or joins a group conversation for a specific video
 * and manages message streaming and sending
 */
export function useVideoChat(videoId: string): UseVideoChatReturn {
  const { client, isLoading: isClientLoading, isConnected, error: clientError } = useXmtpClient();
  const user = useUser();
  const { address: smartAccountAddress } = useModularAccount();
  const walletAddress = smartAccountAddress || user?.address || null;
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<VideoChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<AsyncIterable<DecodedMessage<any>> | null>(null);
  const isStreamingRef = useRef(false);

  // Propagate client errors to the chat error state
  useEffect(() => {
    if (clientError) {
      logError("useVideoChat: XMTP client error detected:", clientError);
      setError(clientError);
    }
  }, [clientError]);

  // Create or get group conversation for this video
  const initializeGroup = useCallback(async () => {
    if (!client || !isConnected || !videoId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get existing group ID from localStorage
      const storageKey = `xmtp-group-${videoId}`;
      const storedGroupId = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;

      let targetGroup: Group | null = null;

      if (storedGroupId) {
        // Try to find the group by ID
        const allGroups = await client.conversations.listGroups({
          consentStates: [ConsentState.Allowed],
        });
        
        targetGroup = allGroups.find((g) => g.id === storedGroupId) || null;
      }

      // If group not found, create a new one
      if (!targetGroup) {
        // Get current user's inbox ID
        const currentUserInboxId = client.inboxId;
        if (!currentUserInboxId) {
          throw new Error("Client inbox ID is not available");
        }
        
        // Create a new group conversation
        targetGroup = await client.conversations.newGroup([currentUserInboxId]);
        
        // Store the group ID for future use
        if (typeof window !== "undefined" && targetGroup.id) {
          localStorage.setItem(storageKey, targetGroup.id);
        }
      }
      
      setGroup(targetGroup);
      
      // Load existing messages
      const existingMessages = await targetGroup.messages();
      log("Loaded existing messages:", existingMessages.length);
      
      const formattedMessages: VideoChatMessage[] = existingMessages.map((msg) => {
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
      
      // Sort messages by timestamp
      formattedMessages.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
      
      log("Formatted and sorted messages:", formattedMessages.length);
      setMessages(formattedMessages);
      setError(null); // Clear any previous errors on success
      log("useVideoChat: Group initialization successful", {
        groupId: targetGroup.id,
        messageCount: formattedMessages.length,
      });
    } catch (err) {
      logError("Error initializing video chat group:", err);
      setError(err instanceof Error ? err : new Error("Failed to initialize chat"));
    } finally {
      setIsLoading(false);
    }
  }, [client, isConnected, videoId]);

  // Initialize group when client is ready
  useEffect(() => {
    log("useVideoChat: Checking initialization conditions", {
      isClientLoading,
      isConnected,
      hasClient: !!client,
      videoId,
    });
    
    if (!isClientLoading && isConnected && client) {
      log("useVideoChat: Starting group initialization");
      initializeGroup();
    } else {
      log("useVideoChat: Waiting for client to be ready", {
        isClientLoading,
        isConnected,
        hasClient: !!client,
      });
    }
  }, [isClientLoading, isConnected, client, initializeGroup, videoId]);

  // Clear errors when initialization state changes to ready
  useEffect(() => {
    if (!isLoading && !isClientLoading && isConnected && client && group && error) {
      log("useVideoChat: Clearing error - initialization complete");
      setError(null);
    }
  }, [isLoading, isClientLoading, isConnected, client, group, error]);

  // Stream messages in real-time
  useEffect(() => {
    if (!client || !group || isStreamingRef.current) {
      return;
    }

    const startStreaming = async () => {
      try {
        isStreamingRef.current = true;
        const groupId = group.id;
        
        log("Starting message stream for group:", groupId);
        
        // Stream all group messages and filter by our group ID
        // This is more efficient than streamAllMessages for group-only filtering
        const stream = await client.conversations.streamAllGroupMessages({
          consentStates: [ConsentState.Allowed],
        });

        streamRef.current = stream;

        // Use for-await loop to process messages
        for await (const message of stream) {
          log("Streamed message received:", {
            id: message.id,
            conversationId: message.conversationId,
            groupId: groupId,
            matches: message.conversationId === groupId,
            content: typeof message.content === "string" ? message.content.substring(0, 50) : "non-string",
            senderInboxId: message.senderInboxId,
          });
          
          // Check if message belongs to our group
          if (message.conversationId === groupId) {
            const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
            const tipData = parseTipMessage(content);
            // Convert sentAtNs (nanoseconds) to Date
            const sentAt = new Date(Number(message.sentAtNs / BigInt(1_000_000)));
            
            const newMessage: VideoChatMessage = {
              id: message.id,
              content,
              senderAddress: message.senderInboxId,
              sentAt,
              type: tipData ? 'tip' : 'text',
              tipData: tipData || undefined,
            };

            log("Processing streamed message for our group:", newMessage);

            setMessages((prev) => {
              // Avoid duplicates by checking message ID
              if (prev.some((m) => m.id === newMessage.id)) {
                log("Duplicate streamed message, skipping");
                return prev;
              }
              
              // Add new message and sort by timestamp
              const updated = [...prev, newMessage];
              updated.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
              
              log("Adding streamed message, new count:", updated.length);
              return updated;
            });
          } else {
            log("Message topic mismatch, ignoring");
          }
        }
      } catch (err) {
        logError("Error streaming messages:", err);
        setError(err instanceof Error ? err : new Error("Failed to stream messages"));
        isStreamingRef.current = false;
      }
    };

    startStreaming();

    // Cleanup on unmount
    return () => {
      isStreamingRef.current = false;
      streamRef.current = null;
    };
  }, [client, group]);

  // Send message to group
  const sendMessage = useCallback(
    async (content: string) => {
      // Check all prerequisites
      if (!client) {
        logWarn("Cannot send message: XMTP client not initialized", { 
          isClientLoading, 
          isConnected,
          hasClient: !!client 
        });
        const errorMsg = isClientLoading 
          ? "Chat is initializing. Please wait a moment and try again."
          : "Chat client failed to initialize. Please refresh the page.";
        setError(new Error(errorMsg));
        return;
      }

      if (!isConnected) {
        logWarn("Cannot send message: XMTP client not connected");
        setError(new Error("Chat connection not established. Please wait a moment and try again."));
        return;
      }

      if (!group) {
        logWarn("Cannot send message: Group not initialized", { 
          isLoading,
          hasGroup: !!group,
          videoId,
          hasClient: !!client,
          isConnected,
        });
        const errorMsg = isLoading
          ? "Chat group is initializing. Please wait a moment and try again."
          : "Chat group failed to initialize. Please refresh the page.";
        setError(new Error(errorMsg));
        return;
      }

      if (!content.trim()) {
        logWarn("Cannot send message: Empty content");
        return;
      }

      if (!walletAddress) {
        logError("No wallet address available for sending message");
        setError(new Error("Wallet address not available"));
        return;
      }

      setIsSending(true);
      setError(null); // Clear any previous errors when attempting to send

      const trimmedContent = content.trim();
      
      // Optimistically add the message immediately before sending
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticMessage: VideoChatMessage = {
        id: tempId,
        content: trimmedContent,
        senderAddress: walletAddress,
        sentAt: new Date(),
        type: 'text',
      };

      log("Adding optimistic message:", optimisticMessage);

      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === tempId || (m.content === trimmedContent && m.senderAddress.toLowerCase() === walletAddress.toLowerCase()))) {
          log("Duplicate optimistic message detected, skipping");
          return prev;
        }
        const updated = [...prev, optimisticMessage];
        updated.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
        log("Adding optimistic message to state, new count:", updated.length);
        return updated;
      });

      try {
        log("Sending message to group:", { content: trimmedContent, groupId: group.id, walletAddress });
        
        // Send the message
        const sentMessageId = await group.send(trimmedContent);
        log("Message sent successfully:", { id: sentMessageId, content: trimmedContent });
        
        // Update the optimistic message with the real message ID if available
        if (sentMessageId && sentMessageId !== tempId) {
          setMessages((prev) => {
            const updated = prev.map((msg) => 
              msg.id === tempId 
                ? { ...msg, id: sentMessageId }
                : msg
            );
            updated.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
            log("Updated optimistic message with real ID:", sentMessageId);
            return updated;
          });
        }

        // Message will also be added via streaming (which will replace/update the optimistic one if needed)
      } catch (err) {
        logError("Error sending message:", err);
        
        // Remove optimistic message on error
        setMessages((prev) => {
          const filtered = prev.filter((msg) => msg.id !== tempId);
          log("Removed optimistic message due to error, new count:", filtered.length);
          return filtered;
        });
        
        setError(err instanceof Error ? err : new Error("Failed to send message"));
      } finally {
        setIsSending(false);
      }
    },
    [group, client, walletAddress, isClientLoading, isConnected, isLoading, videoId]
  );

  // Send tip message to group
  const sendTipMessage = useCallback(
    async (amount: string, token: TokenSymbol, txHash: string) => {
      if (!group || !walletAddress) {
        return;
      }

      setIsSending(true);
      setError(null);

      try {
        // Create tip message as JSON string
        const tipMessage = JSON.stringify({
          type: 'tip',
          amount,
          token,
          txHash,
        });

        const sentMessageId = await group.send(tipMessage);
        
        // Optimistically add the tip message immediately
        const optimisticMessage: VideoChatMessage = {
          id: sentMessageId || `tip-temp-${Date.now()}-${Math.random()}`,
          content: tipMessage,
          senderAddress: walletAddress,
          sentAt: new Date(),
          type: 'tip',
          tipData: {
            amount,
            token,
            txHash,
          },
        };

        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === optimisticMessage.id)) {
            return prev;
          }
          return [...prev, optimisticMessage];
        });

        // Message will also be added via streaming (which will replace the optimistic one with the real one if needed)
      } catch (err) {
        logError("Error sending tip message:", err);
        setError(err instanceof Error ? err : new Error("Failed to send tip message"));
      } finally {
        setIsSending(false);
      }
    },
    [group, walletAddress]
  );

  // Only show loading if we're actually loading (not just waiting for client)
  // Show loading state for max 3 seconds to avoid long skeleton displays
  const [showLoading, setShowLoading] = useState(true);
  
  useEffect(() => {
    if (!isLoading && !isClientLoading) {
      // Stop showing loading once initialization is complete
      setShowLoading(false);
      return;
    }
    
    // Reset loading state when starting to load
    setShowLoading(true);
    
    // Set a timeout to hide loading after 3 seconds (even if still loading)
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [isLoading, isClientLoading]);

  return {
    messages,
    isLoading: showLoading && (isLoading || isClientLoading),
    error,
    group,
    sendMessage,
    sendTipMessage,
    isSending,
  };
}

