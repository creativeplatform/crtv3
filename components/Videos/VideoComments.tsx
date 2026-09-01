"use client";

import React, { useState, useRef, useEffect } from "react";
import { useVideoComments } from "@/lib/hooks/video/useVideoComments";
import { useUser } from "@/lib/wallet/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MessageSquare,
  Send,
  AlertCircle,
  Heart,
  HeartOff,
  Reply,
  Edit2,
  Trash2,
  MoreVertical,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/helpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserDisplayCompact, UserNameDisplay } from "@/components/User/UserDisplay";
import { logger } from '@/lib/utils/logger';


interface VideoCommentsProps {
  videoAssetId: number;
  videoName?: string;
  className?: string;
}

/**
 * Video Comments Component
 * 
 * Persistent comment system for video uploads
 * Features:
 * - Threaded comments (replies)
 * - Like/unlike
 * - Edit/delete
 * - Pagination
 * - Structured UI
 */
export function VideoComments({ videoAssetId, videoName, className }: VideoCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set());
  const [replies, setReplies] = useState<Record<number, any[]>>({});

  const user = useUser();
  const { address: smartAccountAddress } = useModularAccount();
  const userAddress = smartAccountAddress || user?.address || null;

  const {
    comments,
    isLoading,
    error,
    commentCount,
    hasMore,
    createComment,
    updateComment,
    deleteComment,
    toggleLike,
    loadMore,
    refresh,
  } = useVideoComments(videoAssetId);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userAddress) return;

    try {
      await createComment(newComment.trim());
      setNewComment("");
    } catch (err) {
      // Error is handled in hook
    }
  };

  const handleSubmitReply = async (parentId: number) => {
    if (!replyContent.trim() || !userAddress) return;

    try {
      await createComment(replyContent.trim(), parentId);
      setReplyContent("");
      setReplyingTo(null);
      // Refresh to get updated replies count
      await refresh();
    } catch (err) {
      // Error is handled in hook
    }
  };

  const handleStartEdit = (comment: any) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async (commentId: number) => {
    if (!editContent.trim()) return;

    try {
      await updateComment(commentId, editContent.trim());
      setEditingComment(null);
      setEditContent("");
    } catch (err) {
      // Error is handled in hook
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      await deleteComment(commentId);
    } catch (err) {
      // Error is handled in hook
    }
  };

  const loadReplies = async (commentId: number) => {
    if (loadingReplies.has(commentId) || expandedReplies.has(commentId)) return;

    setLoadingReplies(prev => new Set(prev).add(commentId));
    try {
      // Import here to avoid circular dependency
      const { getComments } = await import("@/services/video-comments");
      const replyComments = await getComments({
        video_asset_id: videoAssetId,
        parent_comment_id: commentId,
        limit: 50,
        orderBy: 'created_at',
        orderDirection: 'asc',
      });

      // Load like status
      if (userAddress && replyComments.length > 0) {
        const { getCommentLikesStatus } = await import("@/services/video-comments");
        const commentIds = replyComments.map(c => c.id);
        const likesStatus = await getCommentLikesStatus(commentIds, userAddress);
        replyComments.forEach(comment => {
          comment.is_liked = likesStatus[comment.id] || false;
        });
      }

      setReplies(prev => ({ ...prev, [commentId]: replyComments }));
      setExpandedReplies(prev => new Set(prev).add(commentId));
    } catch (err) {
      logger.error('Error loading replies:', err);
    } finally {
      setLoadingReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const toggleReplies = (commentId: number) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    } else {
      loadReplies(commentId);
    }
  };

  return (
    <div className={cn("border rounded-lg flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h3 className="font-semibold">Comments</h3>
          {commentCount > 0 && (
            <span className="text-sm text-muted-foreground">
              ({commentCount})
            </span>
          )}
        </div>
      </div>

      {/* Comments Area */}
      <div className="flex-1 p-4 space-y-4 max-h-[800px] overflow-y-auto">
        {isLoading && comments.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <h4 className="font-semibold text-foreground mb-2">No comments yet</h4>
            <p className="text-sm">
              Be the first to share your thoughts about &quot;{videoName || "this video"}&quot;
            </p>
          </div>
        ) : (
          <>
            {comments.map((comment) => {
              const userEOA = user?.address?.toLowerCase();
              const userSCA = smartAccountAddress?.toLowerCase();
              const commenterAddress = comment.commenter_address?.toLowerCase();
              const isOwnComment = commenterAddress && (
                (userEOA && commenterAddress === userEOA) ||
                (userSCA && commenterAddress === userSCA)
              );
              const isEditing = editingComment === comment.id;
              const isReplying = replyingTo === comment.id;
              const hasReplies = comment.replies_count > 0;
              const repliesLoaded = expandedReplies.has(comment.id);
              const commentReplies = replies[comment.id] || [];

              return (
                <div key={comment.id} className="space-y-2">
                  {/* Comment */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <UserDisplayCompact
                        address={comment.commenter_address}
                        avatarSize="md"
                        showAddress={false}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <UserNameDisplay
                          address={comment.commenter_address}
                          size="sm"
                          showAddress={true}
                        />
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: new Date(comment.created_at).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
                          })}
                          {comment.is_edited && (
                            <span className="ml-1 italic">(edited)</span>
                          )}
                        </span>
                        {isOwnComment && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStartEdit(comment)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(comment.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <label htmlFor={`edit-comment-${comment.id}`} className="sr-only">
                            Edit comment
                          </label>
                          <Textarea
                            id={`edit-comment-${comment.id}`}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[80px]"
                            maxLength={500}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(comment.id)}
                              disabled={!editContent.trim()}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingComment(null);
                                setEditContent("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {comment.content}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => toggleLike(comment.id)}
                              disabled={!userAddress}
                              title={!userAddress ? "Connect wallet to like" : ""}
                            >
                              {comment.is_liked ? (
                                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                              ) : (
                                <HeartOff className="h-4 w-4" />
                              )}
                              <span className="text-xs">{comment.likes_count}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => setReplyingTo(isReplying ? null : comment.id)}
                              disabled={!userAddress}
                              title={!userAddress ? "Connect wallet to reply" : ""}
                            >
                              <Reply className="h-4 w-4" />
                              <span className="text-xs">Reply</span>
                            </Button>
                            {hasReplies && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5"
                                onClick={() => toggleReplies(comment.id)}
                                disabled={loadingReplies.has(comment.id)}
                              >
                                {repliesLoaded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                                <span className="text-xs">
                                  {loadingReplies.has(comment.id)
                                    ? "Loading..."
                                    : `${comment.replies_count} ${comment.replies_count === 1 ? "reply" : "replies"}`}
                                </span>
                              </Button>
                            )}
                          </div>
                        </>
                      )}

                      {/* Reply Input */}
                      {isReplying && (
                        <div className="mt-3 space-y-2 pl-4 border-l-2">
                          {!userAddress && (
                            <Alert className="mb-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                Connect your wallet to reply
                              </AlertDescription>
                            </Alert>
                          )}
                          <label htmlFor={`reply-comment-${comment.id}`} className="sr-only">
                            Reply to comment
                          </label>
                          <Textarea
                            id={`reply-comment-${comment.id}`}
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder={userAddress ? "Write a reply..." : "Connect your wallet to reply..."}
                            className="min-h-[60px]"
                            maxLength={500}
                            disabled={!userAddress}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSubmitReply(comment.id)}
                              disabled={!replyContent.trim() || !userAddress}
                            >
                              Reply
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyContent("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Replies */}
                      {repliesLoaded && commentReplies.length > 0 && (
                        <div className="mt-3 space-y-3 pl-4 border-l-2">
                          {commentReplies.map((reply) => {
                            const isOwnReply = reply.commenter_address?.toLowerCase() === userAddress?.toLowerCase();
                            return (
                              <div key={reply.id} className="flex gap-2">
                                <div className="flex-shrink-0">
                                  <UserDisplayCompact
                                    address={reply.commenter_address}
                                    avatarSize="sm"
                                    showAddress={false}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <UserNameDisplay
                                      address={reply.commenter_address}
                                      size="sm"
                                      showAddress={true}
                                    />
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(reply.created_at).toLocaleDateString([], {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-xs whitespace-pre-wrap break-words">
                                    {reply.content}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 gap-1"
                                      onClick={() => toggleLike(reply.id)}
                                      disabled={!userAddress}
                                      title={!userAddress ? "Connect wallet to like" : ""}
                                    >
                                      {reply.is_liked ? (
                                        <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                                      ) : (
                                        <HeartOff className="h-3 w-3" />
                                      )}
                                      <span className="text-[10px]">{reply.likes_count}</span>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Load More Comments"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Comment Input */}
      <div className="p-4 border-t">
        {!userAddress && (
          <Alert className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Connect your wallet to post comments
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmitComment}>
          <div className="space-y-2">
            <label htmlFor="new-comment" className="sr-only">
              Add a comment
            </label>
            <Textarea
              id="new-comment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={
                userAddress
                  ? `Add a comment about "${videoName || "this video"}"...`
                  : "Connect your wallet to comment..."
              }
              className="min-h-[80px] resize-none"
              maxLength={500}
              disabled={isLoading || !userAddress}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {newComment.length}/500
              </span>
              <Button
                type="submit"
                disabled={!newComment.trim() || isLoading || !userAddress}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                Post Comment
              </Button>
            </div>
          </div>
        </form>
        {error && !isLoading && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error.message}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

