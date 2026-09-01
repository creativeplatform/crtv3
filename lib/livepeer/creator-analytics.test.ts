import { describe, expect, it } from 'vitest';
import { mergeCreatorAnalytics } from '@/lib/livepeer/creator-analytics';

describe('mergeCreatorAnalytics', () => {
  it('merges Livepeer and DB views with Math.max and sorts by views', () => {
    const byPlayback = new Map([
      ['p1', { viewCount: 50, playtimeMins: 12 }],
      ['p2', { viewCount: 5, playtimeMins: 1 }],
    ]);

    const result = mergeCreatorAnalytics({
      dbVideos: [
        {
          playback_id: 'p1',
          title: 'Alpha',
          thumbnail_url: 'https://example.com/a.jpg',
          views_count: 40,
          likes_count: 3,
          asset_id: 'asset-1',
        },
        {
          playback_id: 'p2',
          title: 'Beta',
          thumbnail_url: null,
          views_count: 20,
          likes_count: 1,
          asset_id: 'asset-2',
        },
      ],
      livepeerByPlayback: byPlayback,
      timeseries: [{ timestamp: 1, viewCount: 10, playtimeMins: 2 }],
      livepeerAvailable: true,
    });

    expect(result.livepeerAvailable).toBe(true);
    expect(result.videos[0]).toMatchObject({
      playbackId: 'p1',
      views: 50,
      playtimeMins: 12,
      likes: 3,
    });
    expect(result.videos[1]).toMatchObject({
      playbackId: 'p2',
      views: 20,
      playtimeMins: 1,
      likes: 1,
    });
    expect(result.summary).toEqual({
      totalViews: 70,
      playtimeMins: 13,
      videoCount: 2,
      likesCount: 4,
    });
    expect(result.timeseries).toHaveLength(1);
  });

  it('still returns DB totals when Livepeer is unavailable', () => {
    const result = mergeCreatorAnalytics({
      dbVideos: [
        {
          playback_id: 'p1',
          title: 'Solo',
          thumbnail_url: null,
          views_count: 9,
          likes_count: 2,
          asset_id: 'a1',
        },
      ],
      livepeerByPlayback: new Map(),
      timeseries: [],
      livepeerAvailable: false,
    });

    expect(result.livepeerAvailable).toBe(false);
    expect(result.summary.totalViews).toBe(9);
    expect(result.videos[0].views).toBe(9);
  });
});
