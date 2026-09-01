"use client";

/**
 * Live stream chat backed by Lens comments on a going-live root post (option B).
 * Replaces XMTP session groups for livestream chat.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchPostReferences,
  post as createLensPost,
} from "@lens-protocol/client/actions";
import { PostReferenceType, postId, uri } from "@lens-protocol/client";
import type { AnyPost } from "@lens-protocol/graphql";
import { textOnly } from "@lens-protocol/metadata";
import { publicClient } from "@/lib/sdk/lens/client";
import { groveService } from "@/lib/sdk/grove/service";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { clearStaleOrbSessionIfNeeded } from "@/lib/sdk/orb/session-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  HelpCircle,
  Loader2,
  MessageCircle,
  Radio,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const POLL_MS = 8_000;

interface LensLiveChatProps {
  lensPostId: string | null | undefined;
  className?: string;
  headerActions?: React.ReactNode;
  variant?: "participant" | "host";
  /** Called when host should create/ensure the going-live post. */
  onEnsurePost?: () => Promise<string | null>;
  ensuringPost?: boolean;
  /** Preview of the Lens post that will be published when chat is activated. */
  goingLivePreview?: string | null;
  /** Stream display name for copy. */
  streamName?: string | null;
}

function commentAuthorLabel(item: AnyPost): string {
  // Lens canary / Songchain posts use `author` (not V2 `by`).
  const raw = item as any;
  const author = raw?.author ?? raw?.by;
  const handle =
    author?.username?.localName ||
    author?.username?.value ||
    author?.handle?.localName ||
    author?.handle?.fullHandle ||
    (typeof author?.username === "string" ? author.username : null);
  if (typeof handle === "string" && handle.length > 0) {
    return handle.startsWith("@") ? handle : `@${handle}`;
  }
  const addr =
    (author?.address as string | undefined) ||
    (author?.ownedBy?.address as string | undefined);
  if (addr) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return "anon";
}

function commentText(item: AnyPost): string {
  const meta = (item as any)?.metadata;
  if (meta?.content && typeof meta.content === "string") return meta.content;
  return "";
}

export function LensLiveChat({
  lensPostId,
  className,
  headerActions,
  variant = "participant",
  onEnsurePost,
  ensuringPost,
  goingLivePreview,
  streamName,
}: LensLiveChatProps) {
  const [message, setMessage] = useState("");
  const [comments, setComments] = useState<AnyPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isHost = variant === "host";

  const {
    canWrite,
    promptWriteAccess,
    getSessionClient,
    lensAccount,
  } = useLensOrbWrite();

  const loadComments = useCallback(async () => {
    if (!lensPostId) return;
    try {
      const result = await fetchPostReferences(publicClient, {
        referencedPost: postId(lensPostId),
        referenceTypes: [PostReferenceType.CommentOn],
      });
      if (result.isOk()) {
        setComments([...result.value.items]);
        setError(null);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      logger.warn("Lens live chat load failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load live chat"
      );
    } finally {
      setLoading(false);
    }
  }, [lensPostId]);

  useEffect(() => {
    if (!lensPostId) return;
    setLoading(true);
    void loadComments();
    const timer = setInterval(() => void loadComments(), POLL_MS);
    return () => clearInterval(timer);
  }, [lensPostId, loadComments]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || !lensPostId) return;

    if (!canWrite) {
      promptWriteAccess();
      toast.info("Link Orb / Lens to chat on this live stream.");
      return;
    }

    setSending(true);
    try {
      const client = await getSessionClient();
      const metadata = textOnly({ content: trimmed, locale: "en" });
      const upload = await groveService.uploadJson(metadata);
      if (!upload.success || !upload.url) {
        throw new Error("Failed to upload message metadata");
      }
      const result = await createLensPost(client, {
        contentUri: uri(upload.url),
        commentOn: { post: postId(lensPostId) },
      });
      if (result.isErr()) {
        throw new Error(result.error.message);
      }
      setMessage("");
      void loadComments();
    } catch (err) {
      clearStaleOrbSessionIfNeeded(err);
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (!lensPostId) {
    return (
      <div
        className={cn(
          "border rounded-lg flex flex-col h-[500px] max-h-[70vh]",
          className
        )}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">Live chat</span>
            {isHost && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="How live chat works"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-left">
                    Activating chat posts a public “going live” announcement on
                    Lens. Viewer messages become comments on that post — anyone
                    on Orb/Lens can discover and join the conversation.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {headerActions}
        </div>
        <div className="flex-1 flex flex-col items-stretch justify-center gap-4 p-5">
          {isHost ? (
            <>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-red-500" />
                  <p className="text-sm font-medium">Activate public live chat</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Optional. When you activate, we publish a Lens post for{" "}
                  <span className="font-medium text-foreground">
                    {streamName?.trim() || "this stream"}
                  </span>
                  . Viewers chat by commenting — visible on Creative TV and Orb.
                  You need Orb linked to your wallet.
                </p>
                <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Review the going-live message below</li>
                  <li>Click Activate live chat</li>
                  <li>Viewers can comment once you&apos;re live</li>
                </ol>
              </div>

              {goingLivePreview && (
                <div className="rounded-md border bg-muted/40 p-3 text-left">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                    Post preview
                  </p>
                  <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/90">
                    {goingLivePreview}
                  </pre>
                </div>
              )}

              {onEnsurePost && (
                <Button
                  className="w-full"
                  onClick={() => void onEnsurePost()}
                  disabled={ensuringPost}
                >
                  {ensuringPost ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Publishing on Lens…
                    </>
                  ) : (
                    "Activate live chat"
                  )}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              The host hasn&apos;t activated public chat for this stream yet.
            </p>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border rounded-lg flex flex-col h-[500px] max-h-[70vh]",
        className
      )}
    >
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium">Live chat</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Lens
          </span>
        </div>
        {headerActions}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && comments.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet — be the first.
          </p>
        ) : (
          comments.map((item) => (
            <div key={item.id} className="text-sm">
              <span className="font-medium text-muted-foreground mr-2">
                {commentAuthorLabel(item)}
              </span>
              <span className="break-words">{commentText(item)}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {!isHost && (
        <div className="p-3 border-t flex gap-2">
          {!canWrite ? (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => promptWriteAccess()}
            >
              Connect Orb to chat
            </Button>
          ) : (
            <>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  lensAccount ? "Say something…" : "Write a message…"
                }
                maxLength={500}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={() => void handleSend()}
                disabled={sending || !message.trim()}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
