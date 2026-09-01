"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/lib/wallet/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import type { VideoComment, CreateCommentInput } from "@/lib/types/video-comments";
import { logger } from '@/lib/utils/logger';

import {
  createComment,
  getComments,
  getCommentCount,
  updateComment,
  deleteComment,
  toggleCommentLike,
  getCommentLikesStatus,
} from "@/services/video-comments";

export interface UseVideoCommentsReturn {
  comments: VideoComment[];
  isLoading: boolean;
  error: Error | null;
  commentCount: number;
  hasMore: boolean;
  createComment: (content: string, parentId?: number | null) => Promise<void>;
  updateComment: (commentId: number, content: string) => Promise<void>;
  deleteComment: (commentId: number) => Promise<void>;
  toggleLike: (commentId: number) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const COMMENTS_PER_PAGE = 20;

/**
 * Hook for managing video comments
 * 
 * Handles persistent comments on video uploads (separate from live chat)
 * Features:
 * - Threaded comments (replies)
 * - Pagination
 * - Like/unlike
 * - Edit/delete
 */
export function useVideoComments(videoAssetId: number): UseVideoCommentsReturn {
  const user = useUser();
  const { address: smartAccountAddress } = useModularAccount();
  const userAddress = smartAccountAddress || user?.address || null;

  const [comments, setComments] = useState<VideoComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Load comments
  const loadComments = useCallback(async (reset = false) => {
    if (!videoAssetId) return;

    setIsLoading(true);
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;
      const newComments = await getComments({
        video_asset_id: videoAssetId,
        parent_comment_id: null, // Top-level comments only
        limit: COMMENTS_PER_PAGE,
        offset: currentOffset,
        orderBy: 'created_at',
        orderDirection: 'desc',
      });

      // Load like status for user
      if (userAddress && newComments.length > 0) {
        const commentIds = newComments.map(c => c.id);
        const likesStatus = await getCommentLikesStatus(commentIds, userAddress);
        newComments.forEach(comment => {
          comment.is_liked = likesStatus[comment.id] || false;
        });
      }

      if (reset) {
        setComments(newComments);
        setOffset(newComments.length);
      } else {
        setComments(prev => [...prev, ...newComments]);
        setOffset(prev => prev + newComments.length);
      }

      setHasMore(newComments.length === COMMENTS_PER_PAGE);

      // Update comment count
      const count = await getCommentCount(videoAssetId);
      setCommentCount(count);
    } catch (err) {
      logger.error('Error loading comments:', err);
      setError(err instanceof Error ? err : new Error('Failed to load comments'));
    } finally {
      setIsLoading(false);
    }
  }, [videoAssetId, offset, userAddress]);

  // Initial load
  useEffect(() => {
    loadComments(true);
  }, [videoAssetId]); // Only reload when video changes

  // Create comment
  const handleCreateComment = useCallback(
    async (content: string, parentId?: number | null) => {
      if (!userAddress || !content.trim()) {
        setError(new Error('You must be connected and provide comment content'));
        return;
      }

      try {
        const input: CreateCommentInput = {
          video_asset_id: videoAssetId,
          parent_comment_id: parentId || null,
          content: content.trim(),
          commenter_address: userAddress,
        };

        const newComment = await createComment(input);
        newComment.is_liked = false;

        if (parentId) {
          // Add as reply to parent comment
          setComments(prev =>
            prev.map(comment =>
              comment.id === parentId
                ? { ...comment, replies: [...(comment.replies || []), newComment] }
                : comment
            )
          );
        } else {
          // Add as top-level comment
          setComments(prev => [newComment, ...prev]);
          setCommentCount(prev => prev + 1);
        }
      } catch (err) {
        logger.error('Error creating comment:', err);
        setError(err instanceof Error ? err : new Error('Failed to create comment'));
        throw err;
      }
    },
    [videoAssetId, userAddress]
  );

  // Update comment
  const handleUpdateComment = useCallback(
    async (commentId: number, content: string) => {
      if (!userAddress) {
        setError(new Error('You must be connected'));
        return;
      }

      try {
        const updated = await updateComment(commentId, { content }, userAddress);
        
        setComments(prev =>
          prev.map(comment =>
            comment.id === commentId
              ? { ...comment, ...updated }
              : comment
          )
        );
      } catch (err) {
        logger.error('Error updating comment:', err);
        setError(err instanceof Error ? err : new Error('Failed to update comment'));
        throw err;
      }
    },
    [userAddress]
  );

  // Delete comment
  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      if (!userAddress) {
        setError(new Error('You must be connected'));
        return;
      }

      try {
        await deleteComment(commentId, userAddress);
        
        setComments(prev => prev.filter(comment => comment.id !== commentId));
        setCommentCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        logger.error('Error deleting comment:', err);
        setError(err instanceof Error ? err : new Error('Failed to delete comment'));
        throw err;
      }
    },
    [userAddress]
  );

  // Toggle like
  const handleToggleLike = useCallback(
    async (commentId: number) => {
      if (!userAddress) {
        setError(new Error('You must be connected to like comments'));
        return;
      }

      try {
        const result = await toggleCommentLike(commentId, userAddress);
        
        setComments(prev =>
          prev.map(comment =>
            comment.id === commentId
              ? { ...comment, is_liked: result.is_liked, likes_count: result.likes_count }
              : comment
          )
        );
      } catch (err) {
        logger.error('Error toggling like:', err);
        setError(err instanceof Error ? err : new Error('Failed to like comment'));
        throw err;
      }
    },
    [userAddress]
  );

  // Load more comments
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await loadComments(false);
  }, [hasMore, isLoading, loadComments]);

  // Refresh comments
  const handleRefresh = useCallback(async () => {
    setOffset(0);
    await loadComments(true);
  }, [loadComments]);

  return {
    comments,
    isLoading,
    error,
    commentCount,
    hasMore,
    createComment: handleCreateComment,
    updateComment: handleUpdateComment,
    deleteComment: handleDeleteComment,
    toggleLike: handleToggleLike,
    loadMore: handleLoadMore,
    refresh: handleRefresh,
  };
}


