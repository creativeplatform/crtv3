import { describe, expect, it } from 'vitest';
import type { AnyPost } from '@lens-protocol/graphql';
import {
  getEmbeddedCreativeTVUrls,
  hasAttachedVideoOrLivestream,
  isQuotePost,
  normalizeFeedPosts,
  shouldSkipLinkPreview,
  stripAttachedMediaBoilerplate,
  type PostMediaItem,
} from './post-utils';

function mockPost(
  id: string,
  typename: string,
  extra: Record<string, unknown> = {},
): AnyPost {
  return {
    id,
    __typename: typename,
    author: { address: '0xabc' },
    ...extra,
  } as unknown as AnyPost;
}

describe('normalizeFeedPosts', () => {
  it('excludes repost wrappers', () => {
    const original = mockPost('post-1', 'Post', {
      metadata: { content: 'hello', __typename: 'TextOnlyMetadata' },
    });
    const repost = mockPost('repost-1', 'Repost', {
      repostOf: original,
    });

    const result = normalizeFeedPosts([repost, original]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('post-1');
  });

  it('includes reposted content when original is not on the page', () => {
    const original = mockPost('post-1', 'Post', {
      metadata: { content: 'hello', __typename: 'TextOnlyMetadata' },
    });
    const repost = mockPost('repost-1', 'Repost', {
      repostOf: original,
    });

    const result = normalizeFeedPosts([repost]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('post-1');
  });

  it('dedupes by underlying content id', () => {
    const original = mockPost('post-1', 'Post', {
      metadata: { content: 'hello', __typename: 'TextOnlyMetadata' },
    });
    const duplicate = mockPost('repost-1', 'Repost', {
      repostOf: original,
    });

    const result = normalizeFeedPosts([original, duplicate]);
    expect(result).toHaveLength(1);
  });

  it('preserves repost wrappers with commentary as quote posts', () => {
    const original = mockPost('post-1', 'Post', {
      metadata: { content: 'original', __typename: 'TextOnlyMetadata' },
    });
    const quote = mockPost('quote-1', 'Repost', {
      metadata: { content: 'my take on this', __typename: 'TextOnlyMetadata' },
      repostOf: original,
    });

    expect(isQuotePost(quote)).toBe(true);

    const result = normalizeFeedPosts([quote, original]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('quote-1');
    expect(result[1].id).toBe('post-1');
  });
});

describe('media link preview dedup', () => {
  const liveMedia: PostMediaItem[] = [
    {
      type: 'livestream',
      url: 'https://tv.creativeplatform.xyz/watch/abc123',
    },
  ];

  it('skips all internal previews when video or livestream attached', () => {
    expect(hasAttachedVideoOrLivestream(liveMedia)).toBe(true);
    expect(
      shouldSkipLinkPreview(
        'https://tv.creativeplatform.xyz/discover/uuid',
        new Set(),
        true,
      ),
    ).toBe(true);
  });

  it('extracts embedded watch urls from media', () => {
    const urls = getEmbeddedCreativeTVUrls(liveMedia);
    expect(urls.has('https://tv.creativeplatform.xyz/watch/abc123')).toBe(true);
    expect(urls.has('/watch/abc123')).toBe(true);
  });

  it('strips boilerplate when media is attached', () => {
    const text =
      'My caption\n\nWatch on Creative TV: https://tv.creativeplatform.xyz/discover/uuid';
    const videoMedia: PostMediaItem[] = [
      { type: 'video', url: 'https://example.com/video.mp4' },
    ];
    expect(stripAttachedMediaBoilerplate(text, videoMedia)).toBe('My caption');
  });
});
