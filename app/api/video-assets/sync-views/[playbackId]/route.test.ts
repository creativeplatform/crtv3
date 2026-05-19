import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockFetchAllViews = vi.fn();
const mockSyncStoredViewsCount = vi.fn();
const mockCreateServiceClient = vi.fn();

vi.mock('botid/server', () => ({
  checkBotId: vi.fn(async () => ({ isBot: false })),
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  rateLimiters: {
    standard: vi.fn(async () => null),
  },
}));

vi.mock('@/app/api/livepeer/views', () => ({
  fetchAllViews: (...args: unknown[]) => mockFetchAllViews(...args),
}));

vi.mock('@/lib/livepeer/sync-view-count', () => ({
  syncStoredViewsCount: (...args: unknown[]) => mockSyncStoredViewsCount(...args),
}));

vi.mock('@/lib/sdk/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

vi.mock('@/lib/utils/logger', () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn() },
}));

import { POST } from './route';

describe('sync-views POST security', () => {
  beforeEach(() => {
    mockCreateServiceClient.mockReturnValue({});
    mockFetchAllViews.mockResolvedValue({
      playbackId: 'playback-1',
      viewCount: 12,
      legacyViewCount: 5,
    });
    mockSyncStoredViewsCount.mockResolvedValue({ viewCount: 17, updated: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('ignores spoofed viewCount in body and uses Livepeer metrics', async () => {
    const request = new NextRequest(
      'http://localhost/api/video-assets/sync-views/playback-1',
      {
        method: 'POST',
        body: JSON.stringify({ viewCount: 1_000_000 }),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ playbackId: 'playback-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      playbackId: 'playback-1',
      viewCount: 17,
    });
    expect(mockFetchAllViews).toHaveBeenCalledWith('playback-1');
    expect(mockSyncStoredViewsCount).toHaveBeenCalledWith(
      {},
      'playback-1',
      17,
    );
  });
});
