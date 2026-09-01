import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import {
  livepeerStudioApiBaseUrl,
  resolveLivepeerStudioAuthToken,
} from '@/lib/sdk/livepeer/studioAuth';

// Mock the auth module
vi.mock('@/lib/sdk/livepeer/studioAuth', () => ({
  livepeerStudioApiBaseUrl: vi.fn(() => 'https://livepeer.example'),
  resolveLivepeerStudioAuthToken: vi.fn(() => 'test-token'),
}));

describe('Real-time viewership API route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns 400 if playbackId is missing', async () => {
    const request = new NextRequest('http://localhost/api/livepeer/views/realtime');
    const response = await GET(request, { params: Promise.resolve({ playbackId: '' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Playback ID is required');
  });

  it('returns 503 if Livepeer token is not configured', async () => {
    vi.mocked(resolveLivepeerStudioAuthToken).mockReturnValueOnce('' as unknown as undefined);

    const request = new NextRequest('http://localhost/api/livepeer/views/realtime/p1');
    const response = await GET(request, { params: Promise.resolve({ playbackId: 'p1' }) });

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toBe('Livepeer is not configured');
  });

  it('queries Livepeer and aggregates viewer count', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([
        { playbackId: 'p1', viewCount: 8, device: 'desktop' },
        { playbackId: 'p1', viewCount: 4, device: 'mobile' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest('http://localhost/api/livepeer/views/realtime/p1');
    const response = await GET(request, { params: Promise.resolve({ playbackId: 'p1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      success: true,
      playbackId: 'p1',
      viewerCount: 12,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://livepeer.example/api/data/views/now?playbackId=p1',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall.length).toBeGreaterThanOrEqual(2);
    const [, options] = firstCall as unknown as [string, RequestInit];
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('handles empty stats or different shapes gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])));

    const request = new NextRequest('http://localhost/api/livepeer/views/realtime/p1');
    const response = await GET(request, { params: Promise.resolve({ playbackId: 'p1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.viewerCount).toBe(0);
  });

  it('returns upstream status if fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 502, statusText: 'Bad Gateway' })),
    );

    const request = new NextRequest('http://localhost/api/livepeer/views/realtime/p1');
    const response = await GET(request, { params: Promise.resolve({ playbackId: 'p1' }) });

    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toBe('Failed to fetch real-time viewership');
  });
});
