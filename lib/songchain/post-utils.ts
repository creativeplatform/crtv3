import type { AnyPost } from '@lens-protocol/graphql';
import { resolveOrbMediaUrl } from '@/lib/sdk/orb/media';
import { parseCreativeTVUrl } from '@/lib/utils/creative-tv-url';

export function resolvePostContent(post: AnyPost): AnyPost | null {
  if (post.__typename === 'Repost') {
    return post.repostOf ?? null;
  }
  return post;
}

/** Read text from the post wrapper itself (not unwrapped repost target). */
export function directPostText(post: AnyPost): string {
  if (!('metadata' in post) || !post.metadata) return '';
  const meta = post.metadata;
  if ('content' in meta && typeof meta.content === 'string') return meta.content;
  if ('title' in meta && typeof meta.title === 'string') return meta.title;
  return '';
}

/** Repost with commentary — should render as a quote in the timeline. */
export function isQuotePost(post: AnyPost): boolean {
  if (post.__typename !== 'Repost') return false;
  return directPostText(post).trim().length > 0;
}

export function getQuotedPost(post: AnyPost): AnyPost | null {
  if (post.__typename === 'Repost') {
    return post.repostOf ?? null;
  }
  return null;
}

/** Root feed posts only — excludes Lens comments. */
export function isRootFeedPost(post: AnyPost): boolean {
  const rootTypename = post.__typename as string;
  if (rootTypename === 'Comment') return false;
  const content = resolvePostContent(post);
  if (!content) return false;
  const contentTypename = content.__typename as string;
  if (contentTypename === 'Comment') return false;
  if ('commentOn' in content && content.commentOn) return false;
  return true;
}

/** Feed list: collapse plain reposts; preserve quote wrappers; dedupe by id. */
export function normalizeFeedPosts(items: readonly AnyPost[]): AnyPost[] {
  const seenIds = new Set<string>();
  const result: AnyPost[] = [];

  for (const item of items) {
    if (!isRootFeedPost(item)) continue;

    if (isQuotePost(item)) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      result.push(item);
      continue;
    }

    const content = resolvePostContent(item);
    if (!content) continue;

    const contentId = content.id;
    if (seenIds.has(contentId)) continue;
    seenIds.add(contentId);
    result.push(content);
  }

  return result;
}

export type PostMediaType = 'image' | 'video' | 'audio' | 'livestream';

export type PostMediaItem = {
  type: PostMediaType;
  url: string;
  cover?: string | null;
  title?: string | null;
  checkLiveApi?: string | null;
  startsAt?: string | null;
};

function pushUniqueMedia(items: PostMediaItem[], item: PostMediaItem | null) {
  if (!item?.url) return;
  if (items.some((m) => m.type === item.type && m.url === item.url)) return;
  items.push(item);
}

function mediaFromAttachment(raw: unknown): PostMediaItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const att = raw as Record<string, unknown>;
  const item = typeof att.item === 'string' ? att.item : null;
  if (!item) return null;
  const typename = typeof att.__typename === 'string' ? att.__typename : '';
  if (typename === 'MediaAudio') {
    const cover =
      att.cover && typeof att.cover === 'string'
        ? resolveOrbMediaUrl(att.cover, { type: 'image' })
        : null;
    return {
      type: 'audio',
      url: resolveOrbMediaUrl(item, { type: 'audio' }) ?? item,
      cover,
    };
  }
  if (typename === 'MediaVideo') {
    const cover =
      att.cover && typeof att.cover === 'string'
        ? resolveOrbMediaUrl(att.cover, { type: 'image' })
        : null;
    return {
      type: 'video',
      url: resolveOrbMediaUrl(item, { type: 'video' }) ?? item,
      cover,
    };
  }
  if (typename === 'MediaImage') {
    return {
      type: 'image',
      url: resolveOrbMediaUrl(item, { type: 'image' }) ?? item,
    };
  }
  return null;
}

export function postText(post: AnyPost): string {
  if (isQuotePost(post)) {
    return directPostText(post);
  }
  const resolved = resolvePostContent(post);
  if (!resolved || !('metadata' in resolved) || !resolved.metadata) return '';
  const meta = resolved.metadata;
  if ('content' in meta && typeof meta.content === 'string') return meta.content;
  if ('title' in meta && typeof meta.title === 'string') return meta.title;
  return '';
}

export function extractPostMedia(post: AnyPost): PostMediaItem[] {
  const resolved = resolvePostContent(post);
  if (!resolved || !('metadata' in resolved) || !resolved.metadata) return [];

  const meta = resolved.metadata as Record<string, unknown>;
  const items: PostMediaItem[] = [];
  const typename = typeof meta.__typename === 'string' ? meta.__typename : '';

  if (typename === 'LiveStreamMetadata' || ('liveUrl' in meta && 'playbackUrl' in meta)) {
    const liveUrl = typeof meta.liveUrl === 'string' ? meta.liveUrl : null;
    const playbackUrl = typeof meta.playbackUrl === 'string' ? meta.playbackUrl : liveUrl;
    const checkLiveApi =
      typeof meta.checkLiveAPI === 'string'
        ? meta.checkLiveAPI
        : typeof meta.checkLiveApi === 'string'
          ? meta.checkLiveApi
          : null;
    const title = typeof meta.title === 'string' ? meta.title : null;
    const startsAt = typeof meta.startsAt === 'string' ? meta.startsAt : null;
    if (playbackUrl || liveUrl) {
      pushUniqueMedia(items, {
        type: 'livestream',
        url: playbackUrl ?? liveUrl ?? '',
        cover: null,
        title,
        checkLiveApi,
        startsAt,
      });
    }
  }

  if ('audio' in meta && meta.audio && typeof meta.audio === 'object') {
    const audio = meta.audio as Record<string, unknown>;
    const item = typeof audio.item === 'string' ? audio.item : null;
    if (item) {
      const cover =
        audio.cover && typeof audio.cover === 'string'
          ? resolveOrbMediaUrl(audio.cover, { type: 'image' })
          : null;
      pushUniqueMedia(items, {
        type: 'audio',
        url: resolveOrbMediaUrl(item, { type: 'audio' }) ?? item,
        cover,
        title: typeof meta.title === 'string' ? meta.title : null,
      });
    }
  }

  if ('video' in meta && meta.video && typeof meta.video === 'object') {
    const video = meta.video as Record<string, unknown>;
    const item = typeof video.item === 'string' ? video.item : null;
    if (item) {
      const cover =
        video.cover && typeof video.cover === 'string'
          ? resolveOrbMediaUrl(video.cover, { type: 'image' })
          : null;
      pushUniqueMedia(items, {
        type: 'video',
        url: resolveOrbMediaUrl(item, { type: 'video' }) ?? item,
        cover,
        title: typeof meta.title === 'string' ? meta.title : null,
      });
    } else if (video.cover && typeof video.cover === 'string') {
      pushUniqueMedia(items, {
        type: 'image',
        url: resolveOrbMediaUrl(video.cover, { type: 'image' }) ?? video.cover,
      });
    }
  }

  if ('image' in meta && meta.image && typeof meta.image === 'object') {
    const image = meta.image as Record<string, unknown>;
    const item = typeof image.item === 'string' ? image.item : null;
    if (item) {
      pushUniqueMedia(items, {
        type: 'image',
        url: resolveOrbMediaUrl(item, { type: 'image' }) ?? item,
      });
    }
  }

  const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
  for (const att of attachments) {
    pushUniqueMedia(items, mediaFromAttachment(att));
  }

  return items;
}

function addCreativeTvUrlVariants(rawUrl: string, out: Set<string>) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return;
  out.add(trimmed);

  const parsed = parseCreativeTVUrl(trimmed);
  if (parsed.kind === 'watch') {
    out.add(parsed.fallbackUrl);
    out.add(`/watch/${parsed.playbackId}`);
  } else if (parsed.kind === 'discover') {
    out.add(parsed.fallbackUrl);
    out.add(`/discover/${parsed.assetId}`);
  } else {
    const watchMatch = trimmed.match(/\/watch\/([^/?#]+)/i);
    if (watchMatch?.[1]) {
      out.add(`/watch/${watchMatch[1]}`);
    }
    const discoverMatch = trimmed.match(/\/discover\/([^/?#]+)/i);
    if (discoverMatch?.[1]) {
      out.add(`/discover/${discoverMatch[1]}`);
    }
  }
}

/** Creative TV URLs already represented by attached media (skip duplicate link previews). */
export function getEmbeddedCreativeTVUrls(media: PostMediaItem[]): Set<string> {
  const urls = new Set<string>();
  for (const item of media) {
    if (item.url) addCreativeTvUrlVariants(item.url, urls);
  }
  return urls;
}

export function hasAttachedVideoOrLivestream(media: PostMediaItem[]): boolean {
  return media.some((item) => item.type === 'video' || item.type === 'livestream');
}

export function stripAttachedMediaBoilerplate(
  text: string,
  media: PostMediaItem[],
): string {
  if (!hasAttachedVideoOrLivestream(media)) return text;

  return text
    .replace(/\s*Watch on Creative TV:\s*https?:\/\/[^\s]+/gi, '')
    .replace(/\s*https?:\/\/[^\s/]+(?:\/[^\s]*)?\/watch\/[^\s]+/gi, '')
    .replace(/\s*I'm live on Creative TV —\s*https?:\/\/[^\s]+/gi, '')
    .trim();
}

export function shouldSkipLinkPreview(
  url: string,
  embeddedUrls: Set<string>,
  skipAllInternal: boolean,
): boolean {
  if (skipAllInternal) return true;
  if (embeddedUrls.has(url)) return true;

  const parsed = parseCreativeTVUrl(url);
  if (parsed.kind === 'watch' || parsed.kind === 'discover') {
    if (embeddedUrls.has(parsed.fallbackUrl)) return true;
    const path =
      parsed.kind === 'watch'
        ? `/watch/${parsed.playbackId}`
        : `/discover/${parsed.assetId}`;
    if (embeddedUrls.has(path)) return true;
  }

  return false;
}

export function extractCreatedPostId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const root = value as Record<string, unknown>;

  if (typeof root.id === 'string' && root.id.length > 0) return root.id;

  const post = root.post;
  if (post && typeof post === 'object') {
    const id = (post as Record<string, unknown>).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }

  const hash = root.hash ?? root.txHash;
  if (typeof hash === 'string' && hash.length > 0) return hash;

  return null;
}
