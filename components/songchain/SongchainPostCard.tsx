"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addReaction,
  undoReaction,
  editPost,
  deletePost,
  bookmarkPost,
  undoBookmarkPost,
  repost,
  post as createLensPost,
  fetchPostReferences,
} from "@lens-protocol/client/actions";
import { evmAddress, postId, uri, PostReferenceType } from "@lens-protocol/client";
import { textOnly } from "@lens-protocol/metadata";
import type { AnyPost } from "@lens-protocol/graphql";
import {
  Heart,
  Loader2,
  MessageCircle,
  Repeat2,
  Bookmark,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { publicClient } from "@/lib/sdk/lens/client";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { groveService } from "@/lib/sdk/grove/service";
import { clearStaleOrbSessionIfNeeded } from "@/lib/sdk/orb/session-errors";
import { SongchainAuthorTimeline } from "@/components/songchain/SongchainAuthorTimeline";
import { MembershipVerifiedBadge } from "@/components/User/MembershipVerifiedBadge";
import { SongchainQuotedPostEmbed } from "@/components/songchain/SongchainQuotedPostEmbed";
import { SongchainPostContent } from "@/components/songchain/SongchainPostContent";
import { SongchainFollowButton } from "@/components/songchain/SongchainGraphPanel";
import { SongchainPostMedia } from "@/components/songchain/SongchainPostMedia";
import {
  extractPostMedia,
  getEmbeddedCreativeTVUrls,
  getQuotedPost,
  hasAttachedVideoOrLivestream,
  isQuotePost,
  postText,
  resolvePostContent,
  stripAttachedMediaBoilerplate,
} from "@/lib/songchain/post-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils/utils";
import {
  songCupActionBtn,
  songCupActionBtnActive,
  songCupBody,
  songCupMuted,
  songCupPostCard,
} from "@/lib/songchain/song-cup/panel-styles";

function authorLabel(post: AnyPost): string {
  const author = post.author;
  if (author.username?.localName) return `@${author.username.localName}`;
  return `${author.address.slice(0, 6)}…${author.address.slice(-4)}`;
}

type SongchainPostCardProps = {
  post: AnyPost;
  feedId?: string | null;
  graphId?: string | null;
  compact?: boolean;
  readOnly?: boolean;
  onReactionChange?: () => void;
  onPostUpdated?: () => void;
  /** Visual variant for the Song Cup grid. */
  variant?: "default" | "song-cup";
};

export function SongchainPostCard({
  post,
  feedId,
  graphId = null,
  compact = false,
  readOnly = false,
  onReactionChange,
  onPostUpdated,
  variant = "default",
}: SongchainPostCardProps) {
  const { canWrite, getSessionClient, promptWriteAccess, lensAccount } =
    useLensOrbWrite();
  const [pending, setPending] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<AnyPost[]>([]);
  const [commentDelta, setCommentDelta] = useState(0);
  const [repostDelta, setRepostDelta] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [displayText, setDisplayText] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const isQuote = isQuotePost(post);
  const quotedPost = isQuote ? getQuotedPost(post) : null;
  const content = isQuote ? quotedPost : resolvePostContent(post);
  const media = useMemo(() => extractPostMedia(content ?? post), [content, post]);
  const ops =
    content != null && "operations" in content ? content.operations : null;
  const hasReacted =
    ops != null && "hasReacted" in ops && ops.hasReacted === true;
  const [upvoted, setUpvoted] = useState(hasReacted);
  const reactions =
    content != null && "stats" in content ? (content.stats?.upvotes ?? 0) : 0;
  const statsComments =
    content != null && "stats" in content ? (content.stats?.comments ?? 0) : 0;
  const statsReposts =
    content != null && "stats" in content ? (content.stats?.reposts ?? 0) : 0;
  const commentCount = statsComments + commentDelta;
  const reposts = statsReposts + repostDelta;
  const embeddedCreativeTVUrls = useMemo(
    () => getEmbeddedCreativeTVUrls(media),
    [media],
  );
  const skipAllInternalPreviews = useMemo(
    () => hasAttachedVideoOrLivestream(media),
    [media],
  );
  const isOwner =
    !!lensAccount &&
    !!content &&
    (isQuote
      ? post.author.address.toLowerCase() === lensAccount.toLowerCase()
      : content.author.address.toLowerCase() === lensAccount.toLowerCase());

  useEffect(() => {
    setUpvoted(hasReacted);
  }, [hasReacted, content?.id]);

  useEffect(() => {
    if (ops && "hasBookmarked" in ops) {
      setBookmarked(Boolean(ops.hasBookmarked));
    }
  }, [ops, content?.id]);

  useEffect(() => {
    setCommentDelta(0);
  }, [content?.id, statsComments]);

  useEffect(() => {
    setRepostDelta(0);
  }, [content?.id, statsReposts]);

  const loadComments = useCallback(async () => {
    if (!content) return;
    try {
      const result = await fetchPostReferences(publicClient, {
        referencedPost: postId(content.id),
        referenceTypes: [PostReferenceType.CommentOn],
      });
      if (result.isOk()) {
        // Update the modal list only — badge count comes from stats + local delta
        // so a partial/stale page does not undercount the feed button.
        setComments([...result.value.items]);
      }
    } catch {
      // Non-fatal
    }
  }, [content]);

  useEffect(() => {
    if (!content) return;
    void loadComments();
  }, [content, loadComments]);

  useEffect(() => {
    if (commentsOpen) void loadComments();
  }, [commentsOpen, loadComments]);

  useEffect(() => {
    setDisplayText(null);
  }, [content?.id, post]);

  const resolvedPostText = stripAttachedMediaBoilerplate(
    displayText ?? postText(post),
    media,
  );

  if (!content) return null;

  const withWrite = async (
    action: string,
    fn: () => Promise<void>,
    opts?: { refresh?: "immediate" | "delayed" | "none" },
  ) => {
    if (!canWrite) {
      promptWriteAccess();
      return;
    }
    setPending(action);
    try {
      await fn();
      const refresh = opts?.refresh ?? "immediate";
      if (refresh === "none") return;
      if (refresh === "delayed") {
        window.setTimeout(() => onReactionChange?.(), 3000);
        return;
      }
      onReactionChange?.();
    } catch (err) {
      clearStaleOrbSessionIfNeeded(err);
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(null);
    }
  };

  const toggleUpvote = () =>
    void withWrite("upvote", async () => {
      const client = await getSessionClient();
      const id = postId(content.id);
      const result = upvoted
        ? await undoReaction(client, { post: id, reaction: "UPVOTE" })
        : await addReaction(client, { post: id, reaction: "UPVOTE" });
      if (result.isErr()) throw new Error(result.error.message);
      setUpvoted(!upvoted);
    });

  const toggleBookmark = () =>
    void withWrite("bookmark", async () => {
      const client = await getSessionClient();
      const id = postId(content.id);
      const result = bookmarked
        ? await undoBookmarkPost(client, { post: id })
        : await bookmarkPost(client, { post: id });
      if (result.isErr()) throw new Error(result.error.message);
      setBookmarked(!bookmarked);
      toast.success(bookmarked ? "Removed bookmark" : "Saved to bookmarks");
    });

  const handleRepost = () =>
    void withWrite(
      "repost",
      async () => {
        const client = await getSessionClient();
        const result = await repost(client, {
          post: postId(content.id),
          ...(feedId ? { feed: evmAddress(feedId) } : {}),
        });
        if (result.isErr()) throw new Error(result.error.message);
        setRepostDelta((d) => d + 1);
        toast.success("Reposted");
      },
      { refresh: "delayed" },
    );

  const submitComment = () =>
    void withWrite(
      "comment",
      async () => {
        const trimmed = commentText.trim();
        if (!trimmed) return;

        const optimisticId = `pending-comment-${Date.now()}`;
        const optimisticComment = {
          id: optimisticId,
          __typename: "Post",
          author: {
            address: lensAccount ?? "",
            username: null,
          },
          metadata: { content: trimmed, __typename: "TextOnlyMetadata" },
        } as unknown as AnyPost;

        setComments((prev) => [...prev, optimisticComment]);
        setCommentDelta((d) => d + 1);

        const client = await getSessionClient();
        const metadata = textOnly({ content: trimmed, locale: "en" });
        const upload = await groveService.uploadJson(metadata);
        if (!upload.success || !upload.url) {
          setComments((prev) => prev.filter((c) => c.id !== optimisticId));
          setCommentDelta((d) => Math.max(0, d - 1));
          throw new Error("Failed to upload comment metadata");
        }
        const result = await createLensPost(client, {
          contentUri: uri(upload.url),
          commentOn: { post: postId(content.id) },
        });
        if (result.isErr()) {
          setComments((prev) => prev.filter((c) => c.id !== optimisticId));
          setCommentDelta((d) => Math.max(0, d - 1));
          throw new Error(result.error.message);
        }
        setCommentText("");
        toast.success("Comment posted");
        void loadComments();
      },
      { refresh: "delayed" },
    );

  const submitEdit = () =>
    void withWrite(
      "edit",
      async () => {
        const trimmed = editText.trim();
        if (!trimmed) return;
        const client = await getSessionClient();
        const metadata = textOnly({ content: trimmed, locale: "en" });
        const upload = await groveService.uploadJson(metadata);
        if (!upload.success || !upload.url) {
          throw new Error("Failed to upload edit metadata");
        }
        const result = await editPost(client, {
          post: postId(content.id),
          contentUri: uri(upload.url),
        });
        if (result.isErr()) throw new Error(result.error.message);
        setDisplayText(trimmed);
        setEditOpen(false);
        toast.success("Post updated");
        onPostUpdated?.();
      },
      { refresh: "delayed" },
    );

  const handleDelete = () => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    void withWrite("delete", async () => {
      const client = await getSessionClient();
      const result = await deletePost(client, { post: postId(content.id) });
      if (result.isErr()) throw new Error(result.error.message);
      toast.success("Post deleted");
    });
  };

  return (
    <>
      <article
        className={cn(
          "relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm break-inside-avoid-column",
          compact && "text-sm",
          isQuote && "border-violet-500/30",
          pending === "edit" && "opacity-70",
          variant === "song-cup" && cn(songCupPostCard, "p-3 text-xs shadow-none"),
        )}
      >
        {pending === "edit" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-md bg-card px-3 py-2 text-sm shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating post…
            </div>
          </div>
        )}
        {media.length > 0 && !compact && !isQuote && (
          <div className="w-full">
            <SongchainPostMedia media={media} compact={compact} />
          </div>
        )}
        <div className={cn("flex flex-col gap-3", variant === "song-cup" ? "p-0" : "p-4")}>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className={cn(
                "inline-flex w-fit items-center gap-1 text-left hover:text-violet-400",
                variant === "song-cup" ? cn("text-xs", songCupMuted) : "text-xs text-muted-foreground",
              )}
              onClick={() => setTimelineOpen(true)}
            >
              {authorLabel(isQuote ? post : content)}
              <MembershipVerifiedBadge
                address={
                  isQuote
                    ? post.author.address
                    : content?.author.address ?? post.author.address
                }
              />
            </button>
            {content && variant !== "song-cup" && (
              <SongchainFollowButton
                graphId={graphId}
                accountAddress={
                  isQuote ? post.author.address : content.author.address
                }
              />
            )}
          </div>
          {compact && media.length > 0 && (
            <div className={cn(variant === "song-cup" && "max-h-28 overflow-hidden rounded-[12px]")}>
              <SongchainPostMedia media={media} compact={compact} />
            </div>
          )}
          {resolvedPostText && (
            <SongchainPostContent
              text={resolvedPostText}
              compact={compact}
              className={cn(variant === "song-cup" && cn("text-xs", songCupBody))}
              embeddedCreativeTVUrls={embeddedCreativeTVUrls}
              skipAllInternalPreviews={skipAllInternalPreviews}
            />
          )}
          {quotedPost && <SongchainQuotedPostEmbed quotedPost={quotedPost} />}
          <div
            className={cn(
              "mt-auto flex flex-nowrap items-center gap-0.5 overflow-x-auto pt-2",
              variant === "song-cup" ? "border-t border-border/50 dark:border-white/10" : "border-t border-border/40",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={readOnly || pending === "upvote"}
              onClick={readOnly ? undefined : toggleUpvote}
              className={cn(
                "shrink-0 gap-0.5 px-1.5",
                upvoted && variant === "song-cup" ? songCupActionBtnActive : upvoted && "text-rose-500",
                variant === "song-cup" ? songCupActionBtn : undefined,
              )}
              aria-label={`Upvote${reactions > 0 ? ` (${reactions})` : ""}`}
            >
              {pending === "upvote" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Heart className={cn("h-3 w-3", upvoted && "fill-current")} />
              )}
              {reactions > 0 && (
                <span className="text-[10px] tabular-nums">{reactions}</span>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCommentsOpen(true)}
              aria-label={`Comments${commentCount > 0 ? ` (${commentCount})` : ""}`}
              className={cn(
                "shrink-0 gap-0.5 px-1.5",
                readOnly && "text-muted-foreground",
                variant === "song-cup" && songCupActionBtn,
              )}
            >
              <MessageCircle className="h-3 w-3" />
              {commentCount > 0 && (
                <span className="text-[10px] tabular-nums">{commentCount}</span>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={readOnly || pending === "repost"}
              onClick={readOnly ? undefined : handleRepost}
              aria-label={`Repost${reposts > 0 ? ` (${reposts})` : ""}`}
              className={cn(
                "shrink-0 gap-0.5 px-1.5",
                variant === "song-cup" && songCupActionBtn,
              )}
            >
              {pending === "repost" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Repeat2 className="h-3 w-3" />
              )}
              {reposts > 0 && (
                <span className="text-[10px] tabular-nums">{reposts}</span>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={readOnly || pending === "bookmark"}
              onClick={readOnly ? undefined : toggleBookmark}
              className={cn(
                "shrink-0 px-1.5",
                bookmarked && variant === "song-cup" ? songCupActionBtnActive : bookmarked && "text-amber-500",
                variant === "song-cup" && songCupActionBtn,
              )}
              aria-label="Bookmark"
            >
              {pending === "bookmark" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Bookmark className={cn("h-3 w-3", bookmarked && "fill-current")} />
              )}
            </Button>
            {isOwner && !readOnly && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditText(postText(post));
                    setEditOpen(true);
                  }}
                  aria-label="Edit post"
                  className={cn("shrink-0 px-1.5", variant === "song-cup" && songCupActionBtn)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending === "delete"}
                  onClick={handleDelete}
                  className={cn(
                    "shrink-0 px-1.5 text-destructive",
                    variant === "song-cup" && songCupActionBtn,
                  )}
                  aria-label="Delete post"
                >
                  {pending === "delete" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </article>

      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Comments{commentCount > 0 ? ` (${commentCount})` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {comments.length > 0 ? (
              <ul className="space-y-2 text-xs text-muted-foreground">
                {comments.map((c) => (
                  <li key={c.id} className="rounded bg-muted/40 p-2">
                    <span className="font-medium">{authorLabel(c)}: </span>
                    <SongchainPostContent text={postText(c)} compact />
                    {c.id.startsWith("pending-comment-") && (
                      <span className="ml-1 text-[10px] text-violet-400">· posting…</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
            {readOnly ? (
              <p className="text-sm text-muted-foreground">Join the club to add comments.</p>
            ) : canWrite ? (
              <div className="flex gap-2">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment…"
                  rows={3}
                  className="text-xs"
                />
                <Button
                  size="sm"
                  disabled={pending === "comment" || !commentText.trim()}
                  onClick={submitComment}
                >
                  Post
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={promptWriteAccess}>
                Link Orb to comment
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SongchainAuthorTimeline
        authorAddress={
          isQuote ? post.author.address : content.author.address
        }
        authorLabel={authorLabel(isQuote ? post : content)}
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
      />

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (pending !== "edit") setEditOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          {pending === "edit" ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating post…
            </div>
          ) : (
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              disabled={pending === "edit"}
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={pending === "edit"}
            >
              Cancel
            </Button>
            <Button
              disabled={pending === "edit" || !editText.trim()}
              onClick={submitEdit}
            >
              {pending === "edit" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
