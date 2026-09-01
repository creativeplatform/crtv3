"use client";

import React, { useState, useRef, useEffect } from "react";
import { useVideoChat } from "@/lib/hooks/xmtp/useVideoChat";
import { useUser } from "@/lib/wallet/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageCircle, Send, AlertCircle, ExternalLink, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/helpers";
import { VideoTipButton } from "./VideoTipButton";
import { getExplorerUrl } from "@/lib/utils/video-tip";
import { logger } from '@/lib/utils/logger';


interface VideoChatProps {
  videoId: string;
  videoName?: string;
  creatorAddress?: string | null;
  className?: string;
}

/**
 * Video Chat Component
 * 
 * Displays a chat interface for viewers to discuss a specific video
 * Uses XMTP for decentralized, end-to-end encrypted messaging
 */
export function VideoChat({ videoId, videoName, creatorAddress, className }: VideoChatProps) {
  const [message, setMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const user = useUser();
  const { address: smartAccountAddress } = useModularAccount();

  const { messages, isLoading, error, sendMessage, sendTipMessage, isSending } = useVideoChat(videoId);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSending) return;

    const messageToSend = message.trim();
    setMessage("");
    
    try {
      await sendMessage(messageToSend);
    } catch (err) {
      // Error is already handled in useVideoChat hook
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
            Connect your wallet to join the chat
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg flex flex-col h-[600px] max-h-[80vh]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <h3 className="font-semibold">Video Chat</h3>
          {messages.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({messages.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {creatorAddress && user && user.address?.toLowerCase() !== creatorAddress.toLowerCase() && (
            <VideoTipButton
              creatorAddress={creatorAddress}
              onTipSuccess={(txHash, amount, token) => {
                sendTipMessage(amount, token, txHash);
              }}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="md:hidden"
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      {isExpanded && (
        <>
          <div className="flex-1 p-4 overflow-y-auto">
            {isLoading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="space-y-3 mb-4">
                  <Skeleton className="h-12 w-12 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-48 mx-auto" />
                  <Skeleton className="h-4 w-64 mx-auto" />
                </div>
                <p className="text-sm text-muted-foreground">Initializing chat...</p>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error.message}
                  {error.message.includes("WASM") && (
                    <div className="mt-2 text-xs">
                      <p className="font-semibold mb-1">Troubleshooting:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Refresh the page</li>
                        <li>Clear browser cache</li>
                        <li>Check browser console for details</li>
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4">
                <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
                <h4 className="font-semibold text-foreground mb-2">Start the conversation!</h4>
                <p className="text-sm mb-1">
                  No messages yet about <span className="font-medium text-foreground">&quot;{videoName}&quot;</span>.
                </p>
                <p className="text-sm">Be the first to share your thoughts!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => {
                  // Check if message is from current user (handle both EOA and smart account)
                  const userEOA = user?.address?.toLowerCase();
                  const userSCA = smartAccountAddress?.toLowerCase();
                  const msgAddress = msg.senderAddress?.toLowerCase();
                  const isOwnMessage = msgAddress && (
                    (userEOA && msgAddress === userEOA) || 
                    (userSCA && msgAddress === userSCA)
                  );
                  const isTipMessage = msg.type === 'tip' && msg.tipData;
                  
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-3",
                        isOwnMessage && "flex-row-reverse"
                      )}
                    >
                      <div className="flex-shrink-0">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center",
                          isTipMessage 
                            ? "bg-yellow-500/20 border-2 border-yellow-500/50" 
                            : "bg-primary/10"
                        )}>
                          {isTipMessage ? (
                            <Coins className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                          ) : (
                            <span className="text-xs font-medium">
                              {formatAddress(msg.senderAddress).slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex-1 space-y-1",
                          isOwnMessage && "text-right"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {isOwnMessage ? "You" : formatAddress(msg.senderAddress)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.sentAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {isTipMessage ? (
                          <div
                            className={cn(
                              "rounded-lg p-3 text-sm border-2 border-yellow-500/50 bg-yellow-500/10",
                              "max-w-[80%]",
                              isOwnMessage && "ml-auto"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Coins className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              <span className="font-semibold text-yellow-700 dark:text-yellow-300">
                                {formatAddress(msg.senderAddress)} tipped {msg.tipData?.amount} {msg.tipData?.token} to the creator!
                              </span>
                            </div>
                            <a
                              href={getExplorerUrl(msg.tipData?.txHash || "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline"
                            >
                              View on Explorer
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "rounded-lg p-3 text-sm",
                              isOwnMessage
                                ? "bg-primary text-primary-foreground ml-auto max-w-[80%]"
                                : "bg-muted max-w-[80%]"
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

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  isLoading 
                    ? "Initializing chat..." 
                    : `Share your thoughts about "${videoName || "this video"}"...`
                }
                disabled={isSending || isLoading}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={!message.trim() || isSending || isLoading}
                title={isLoading ? "Chat is initializing..." : undefined}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {error && !isLoading && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {error.message}
                  {error.message.includes("initializing") && (
                    <span className="block mt-1 text-xs opacity-75">
                      This usually resolves automatically. If it persists, try refreshing the page.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </>
      )}
    </div>
  );
}

