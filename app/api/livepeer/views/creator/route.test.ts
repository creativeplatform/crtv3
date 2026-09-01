import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const CREATOR = '0xcccccccccccccccccccccccccccccccccccccccc';
const OTHER = '0xdddddddddddddddddddddddddddddddddddddddd';

const mockRequireWalletAuthFor = vi.fn();
const mockCreateServiceClient = vi.fn();
const mockFetchCreatorLivepeerMetrics = vi.fn();

vi.mock('@/lib/middleware/rateLimit', () => ({
  rateLimiters: { generous: vi.fn(async () => null) },
}));

vi.mock('@/lib/auth/require-wallet', () => ({
  requireWalletAuthFor: (...args: unknown[]) => mockRequireWalletAuthFor(...args),
  WalletAuthError: class WalletAuthError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
      this.name = 'WalletAuthError';
    }
  },
}));

vi.mock('@/lib/sdk/supabase/service', () => ({
  createServiceClient: (...args: unknown[]) => mockCreateServiceClient(...args),
}));

vi.mock('@/lib/livepeer/creator-analytics', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/livepeer/creator-analytics')
  >('@/lib/livepeer/creator-analytics');
  return {
    ...actual,
    fetchCreatorLivepeerMetrics: (...args: unknown[]) =>
      mockFetchCreatorLivepeerMetrics(...args),
  };
});

vi.mock('@/lib/utils/logger', () => ({
  serverLogger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('viem', () => ({
  isAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value),
}));

import { GET } from './route';

function analyticsRequest(creatorId: string) {
  return new NextRequest(
    `http://localhost/api/livepeer/views/creator?creatorId=${creatorId}`,
  );
}

describe('GET /api/livepeer/views/creator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireWalletAuthFor.mockResolvedValue({ address: CREATOR });
    mockFetchCreatorLivepeerMetrics.mockResolvedValue({
      byPlayback: new Map([['p1', { viewCount: 12, playtimeMins: 3 }]]),
      timeseries: [{ timestamp: 1000, viewCount: 4, playtimeMins: 1 }],
      available: true,
    });
    mockCreateServiceClient.mockReturnValue({
      from: () => ({
        select: () => ({
          ilike: () => ({
            in: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      playback_id: 'p1',
                      title: 'My Video',
                      thumbnail_url: null,
                      views_count: 10,
                      likes_count: 2,
                      asset_id: 'asset-1',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid creatorId', async () => {
    const res = await GET(analyticsRequest('not-an-address'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_CREATOR_ID');
  });

  it('returns 403 when wallet does not own the creatorId', async () => {
    const { WalletAuthError } = await import('@/lib/auth/require-wallet');
    mockRequireWalletAuthFor.mockRejectedValue(
      new WalletAuthError(403, 'Authenticated address does not match'),
    );

    const res = await GET(analyticsRequest(OTHER));
    expect(res.status).toBe(403);
  });

  it('returns merged analytics for the authenticated creator', async () => {
    const res = await GET(analyticsRequest(CREATOR));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.creatorId).toBe(CREATOR);
    expect(body.summary.totalViews).toBe(12);
    expect(body.summary.videoCount).toBe(1);
    expect(body.videos[0]).toMatchObject({
      playbackId: 'p1',
      title: 'My Video',
      views: 12,
      likes: 2,
    });
    expect(body.livepeerAvailable).toBe(true);
    expect(mockRequireWalletAuthFor).toHaveBeenCalledWith(
      expect.anything(),
      CREATOR,
    );
  });
});
