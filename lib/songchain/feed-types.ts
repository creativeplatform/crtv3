export type SongchainCreatedPost = {
  postId: string;
  content: string;
  authorAddress?: string;
  thumbnailUrl?: string;
  title?: string;
};

export type PendingFeedPost = {
  kind: 'pending';
  localId: string;
  postId: string;
  content: string;
  thumbnailUrl?: string;
  title?: string;
  timedOut?: boolean;
};
