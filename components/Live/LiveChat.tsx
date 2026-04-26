"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useLiveChatModerated } from "@/lib/hooks/xmtp/useLiveChatModerated";
import { useUser } from "@account-kit/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MessageCircle,
  Send,
  AlertCircle,
  Coins,
  Users,
  ChevronDown,
  EyeOff,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/helpers";
import { toast } from "sonner";
import { VideoTipButton } from "../Videos/VideoTipButton";
import { getExplorerUrl } from "@/lib/utils/video-tip";
import { logger } from '@/lib/utils/logger';


interface LiveChatProps {
  streamId: string;
  sessionId: string;
  creatorAddress?: string | null;
  viewerCount?: number;
  className?: string;
  /** Enable moderation overlay (poll for hidden/banned + show mod controls). */
  enableModeration?: boolean;
  headerActions?: React.ReactNode;
}

/**
 * Live Chat Component for Livestreaming
 * 
 * Optimized for real-time, high-volume chat during live streams
 * Features:
 * - Session-based groups (ephemeral)
 * - Message rate limiting
 * - Auto-cleanup of old messages
 * - Optimized performance for high message volume
 */
export function LiveChat({
  streamId,
  sessionId,
  creatorAddress,
  viewerCount,
  className,
  enableModeration = true,
  headerActions,
}: LiveChatProps) {
  const [message, setMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const user = useUser();
  const { address: smartAccountAddress } = useModularAccount();

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    sendTipMessage,
    isSending,
    canModerate,
    hideMessage: hideMessageMod,
    banUser: banUserMod,
  } = useLiveChatModerated(streamId, sessionId, {
    maxMessages: 200,
    messageRetentionMs: 10 * 60 * 1000, // 10 minutes
    rateLimit: { count: 5, windowMs: 10000 }, // 5 messages per 10 seconds
    creatorAddress: creatorAddress ?? null,
    enabled: enableModeration,
  });

  // Scroll tracking
  const shouldAutoScroll = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessagesLen = useRef(messages.length);

  // Track new messages arriving while scrolled up
  useEffect(() => {
    const newCount = messages.length - prevMessagesLen.current;
    prevMessagesLen.current = messages.length;

    if (newCount > 0 && !shouldAutoScroll.current) {
      setUnreadCount(prev => prev + newCount);
      setShowScrollToBottom(true);
    }
  }, [messages.length]);

  // Scroll to bottom when new messages arrive (if user is near bottom)
  useEffect(() => {
    if (shouldAutoScroll.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Track scroll position
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    shouldAutoScroll.current = isNearBottom;

    if (isNearBottom) {
      setShowScrollToBottom(false);
      setUnreadCount(0);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollToBottom(false);
    setUnreadCount(0);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSending) return;

    const messageToSend = message.trim();
    setMessage("");
    
    try {
      await sendMessage(messageToSend);
    } catch (err) {
      logger.error("Failed to send message:", err);
    }
  };

  // Show connection prompt if wallet not connected
  if (!user) {
    return (
      <div className={cn("border rounded-lg p-4", className)}>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Connect your wallet to join the live chat
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Display messages in chronological order (tips are styled differently but stay in-line)
  const sortedMessages = useMemo(() => [...messages], [messages]);

  return (
    <div className={cn("border rounded-lg flex flex-col h-[500px] max-h-[70vh]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-red-500" />
          <h3 className="font-semibold text-sm">Live Chat</h3>
          {viewerCount !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{viewerCount}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {creatorAddress && user && user.address?.toLowerCase() !== creatorAddress.toLowerCase() && (
            <VideoTipButton
              creatorAddress={creatorAddress}
              onTipSuccess={(txHash, amount, token) => {
                sendTipMessage(amount, token, txHash);
              }}
            />
          )}
        </div>
      </div>

      {/* Messages Area */}
      {isExpanded && (
        <>
          <div className="relative flex-1 overflow-hidden">
            {/* Scroll to bottom button */}
            {showScrollToBottom && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-xs shadow-lg flex items-center gap-1 hover:opacity-90 transition-opacity"
              >
                <ChevronDown className="h-3 w-3" />
                {unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'}` : 'Scroll to bottom'}
              </button>
            )}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="h-full p-3 overflow-y-auto space-y-2"
          >
            {isLoading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="space-y-2 mb-4">
                  <Skeleton className="h-8 w-8 rounded-full mx-auto" />
                  <Skeleton className="h-3 w-32 mx-auto" />
                </div>
                <p className="text-xs text-muted-foreground">Connecting to live chat...</p>
              </div>
            ) : error ? (
              <Alert variant="destructive" className="my-2">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-xs">{error.message}</AlertDescription>
              </Alert>
            ) : sortedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4">
                <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs">Be the first to chat!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedMessages.map((msg) => {
                  const userEOA = user?.address?.toLowerCase();
                  const userSCA = smartAccountAddress?.toLowerCase();
                  const msgAddress = msg.senderAddress?.toLowerCase();
                  const isOwnMessage = msgAddress && (
                    (userEOA && msgAddress === userEOA) ||
                    (userSCA && msgAddress === userSCA)
                  );
                  const isTipMessage = msg.type === 'tip' && msg.tipData;
                  const showModControls = canModerate && !isTipMessage && !isOwnMessage;

                  const handleHide = async () => {
                    try {
                      await hideMessageMod(msg.id);
                      toast.success("Message hidden");
                    } catch (err) {
                      logger.error("Failed to hide message:", err);
                      toast.error(err instanceof Error ? err.message : "Failed to hide message");
                    }
                  };

                  const handleBan = async () => {
                    if (!msg.senderAddress) return;
                    try {
                      await banUserMod(msg.senderAddress);
                      toast.success(`Banned ${formatAddress(msg.senderAddress)}`);
                    } catch (err) {
                      logger.error("Failed to ban user:", err);
                      toast.error(err instanceof Error ? err.message : "Failed to ban user");
                    }
                  };

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "group/msg flex gap-2 items-start",
                        isOwnMessage && "flex-row-reverse"
                      )}
                    >
                      <div className="flex-shrink-0">
                        <div className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center text-[10px]",
                          isTipMessage 
                            ? "bg-yellow-500/20 border border-yellow-500/50" 
                            : "bg-primary/10"
                        )}>
                          {isTipMessage ? (
                            <Coins className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                          ) : (
                            <span className="font-medium">
                              {formatAddress(msg.senderAddress).slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex-1 min-w-0",
                          isOwnMessage && "text-right"
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-medium">
                            {isOwnMessage ? "You" : formatAddress(msg.senderAddress)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.sentAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {showModControls && (
                            <div
                              className={cn(
                                "ml-auto flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity",
                                isOwnMessage && "ml-0 mr-auto"
                              )}
                            >
                              <button
                                type="button"
                                onClick={handleHide}
                                title="Hide this message"
                                className="p-0.5 rounded hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground"
                              >
                                <EyeOff className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={handleBan}
                                title="Ban this user from chat"
                                className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              >
                                <UserX className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {isTipMessage ? (
                          <div
                            className={cn(
                              "rounded-md p-2 text-xs border border-yellow-500/50 bg-yellow-500/10",
                              "max-w-[85%]",
                              isOwnMessage && "ml-auto"
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <Coins className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                              <span className="font-semibold text-yellow-700 dark:text-yellow-300">
                                {formatAddress(msg.senderAddress)} tipped {msg.tipData?.amount} {msg.tipData?.token}!
                              </span>
                            </div>
                            <a
                              href={getExplorerUrl(msg.tipData?.txHash || "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 underline mt-1"
                            >
                              View on Explorer
                            </a>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "rounded-md px-2.5 py-1.5 text-xs",
                              isOwnMessage
                                ? "bg-primary text-primary-foreground ml-auto max-w-[85%]"
                                : "bg-muted max-w-[85%]"
                            )}
                          >
                            {msg.content}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-3 border-t bg-muted/30">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending || isLoading}
                className="flex-1 text-sm h-9"
                maxLength={500}
              />
              <Button 
                type="submit" 
                size="sm"
                disabled={!message.trim() || isSending || isLoading}
                title={isLoading ? "Chat is initializing..." : undefined}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            {error && !isLoading && error.message.includes("Rate limit") && (
              <Alert variant="destructive" className="mt-2 py-1.5">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-xs">{error.message}</AlertDescription>
              </Alert>
            )}
          </form>
        </>
      )}
    </div>
  );
}


