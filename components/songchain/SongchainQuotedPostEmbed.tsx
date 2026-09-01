"use client";

import type { AnyPost } from "@lens-protocol/graphql";
import { Quote } from "lucide-react";
import { SongchainPostContent } from "@/components/songchain/SongchainPostContent";
import { SongchainPostMedia } from "@/components/songchain/SongchainPostMedia";
import {
  extractPostMedia,
  getEmbeddedCreativeTVUrls,
  hasAttachedVideoOrLivestream,
  postText,
  stripAttachedMediaBoilerplate,
} from "@/lib/songchain/post-utils";
import { cn } from "@/lib/utils/utils";

function authorLabel(post: AnyPost): string {
  const author = post.author;
  if (author.username?.localName) return `@${author.username.localName}`;
  return `${author.address.slice(0, 6)}…${author.address.slice(-4)}`;
}

type SongchainQuotedPostEmbedProps = {
  quotedPost: AnyPost;
  className?: string;
};

export function SongchainQuotedPostEmbed({
  quotedPost,
  className,
}: SongchainQuotedPostEmbedProps) {
  const media = extractPostMedia(quotedPost);
  const embeddedCreativeTVUrls = getEmbeddedCreativeTVUrls(media);
  const skipAllInternalPreviews = hasAttachedVideoOrLivestream(media);
  const text = stripAttachedMediaBoilerplate(postText(quotedPost), media);

  return (
    <div
      className={cn(
        "mt-3 rounded-lg border border-violet-500/25 border-l-4 border-l-violet-500 bg-muted/30 p-3",
        className,
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400">
        <Quote className="h-3 w-3" aria-hidden />
        Quoted post
      </p>
      <p className="text-xs text-muted-foreground">{authorLabel(quotedPost)}</p>
      {media.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-md">
          <SongchainPostMedia media={media} compact />
        </div>
      )}
      {text && (
        <div className="mt-2 text-sm text-muted-foreground">
          <SongchainPostContent
            text={text}
            compact
            maxLines={4}
            embeddedCreativeTVUrls={embeddedCreativeTVUrls}
            skipAllInternalPreviews={skipAllInternalPreviews}
          />
        </div>
      )}
    </div>
  );
}
