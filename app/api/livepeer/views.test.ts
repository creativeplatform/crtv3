import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllViews } from './views';
import {
  livepeerStudioApiBaseUrl,
  resolveLivepeerStudioAuthToken,
} from '@/lib/sdk/livepeer/studioAuth';
import { getFullLivepeer } from '@/lib/sdk/livepeer/fullClient';

vi.mock('@/lib/sdk/livepeer/fullClient', () => ({
  getFullLivepeer: vi.fn(() => null),
}));

describe('Livepeer view metrics helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('prefers the full Livepeer API key', () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', 'full-key');
    vi.stubEnv('LIVEPEER_API_KEY', 'standard-key');

    expect(resolveLivepeerStudioAuthToken()).toBe('full-key');
  });

  it('strips surrounding quotes from Livepeer API keys', () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', '"quoted-full-key"');
    vi.stubEnv('LIVEPEER_API_KEY', '');

    expect(resolveLivepeerStudioAuthToken()).toBe('quoted-full-key');
  });

  it('normalizes the Studio API base URL', () => {
    vi.stubEnv('LIVEPEER_FULL_API_URL', 'https://livepeer.example/');

    expect(livepeerStudioApiBaseUrl()).toBe('https://livepeer.example');
  });

  it('prefers SDK getViewership when a private API key is configured', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', 'full-key');
    const getViewership = vi.fn(async () => ({
      data: [
        {
          playbackId: 'playback-1',
          viewCount: 7,
          playtimeMins: 2.5,
        },
      ],
      statusCode: 200,
    }));
    vi.mocked(getFullLivepeer).mockReturnValue({
      metrics: { getViewership },
    } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: true,
      metrics: {
        playbackId: 'playback-1',
        viewCount: 7,
        playtimeMins: 2.5,
        legacyViewCount: 0,
      },
    });
    expect(getViewership).toHaveBeenCalledWith({
      playbackId: 'playback-1',
      from: expect.any(Date),
      to: expect.any(Date),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips SDK getViewership and uses HTTP when only a standard API key is configured', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', '');
    vi.stubEnv('LIVEPEER_API_KEY', 'standard-key');
    const getViewership = vi.fn();
    vi.mocked(getFullLivepeer).mockReturnValue({
      metrics: { getViewership },
    } as never);
    const fetchMock = vi.fn(async () =>
      Response.json({
        playbackId: 'playback-1',
        viewCount: 4,
        playtimeMins: 1,
        legacyViewCount: 0,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: true,
      metrics: {
        playbackId: 'playback-1',
        viewCount: 4,
        playtimeMins: 1,
        legacyViewCount: 0,
      },
    });
    expect(getViewership).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('falls back to HTTP when SDK getViewership fails', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', 'full-key');
    const getViewership = vi.fn(async () => ({
      error: { message: 'upstream unavailable' },
      statusCode: 500,
    }));
    vi.mocked(getFullLivepeer).mockReturnValue({
      metrics: { getViewership },
    } as never);
    const fetchMock = vi.fn(async () =>
      Response.json({
        playbackId: 'playback-1',
        viewCount: 9,
        playtimeMins: 2,
        legacyViewCount: 0,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: true,
      metrics: {
        playbackId: 'playback-1',
        viewCount: 9,
        playtimeMins: 2,
        legacyViewCount: 0,
      },
    });
    expect(getViewership).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('fetches view metrics without using cache (single object response)', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', 'full-key');
    const fetchMock = vi.fn(async () =>
      Response.json({
        playbackId: 'playback-1',
        viewCount: 12,
        playtimeMins: 34,
        legacyViewCount: 5,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: true,
      metrics: {
        playbackId: 'playback-1',
        viewCount: 12,
        playtimeMins: 34,
        legacyViewCount: 5,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://livepeer.studio/api/data/views/query/total/playback-1',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
  });

  it('fetches view metrics correctly when Livepeer responds with an array (standard Livepeer response)', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', 'full-key');
    const fetchMock = vi.fn(async () =>
      Response.json([
        {
          playbackId: 'playback-1',
          viewCount: 12,
          playtimeMins: 34,
          legacyViewCount: 5,
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: true,
      metrics: {
        playbackId: 'playback-1',
        viewCount: 12,
        playtimeMins: 34,
        legacyViewCount: 5,
      },
    });
  });

  it('falls back to viewership query when total endpoint returns zero views', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', 'full-key');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/query/total/')) {
        return Response.json({ playbackId: 'playback-1', viewCount: 0, playtimeMins: 0 });
      }
      if (url.includes('/query?')) {
        return Response.json([
          { playbackId: 'playback-1', viewCount: 3, playtimeMins: 1.5 },
        ]);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: true,
      metrics: {
        playbackId: 'playback-1',
        viewCount: 3,
        playtimeMins: 1.5,
        legacyViewCount: 0,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to viewership query when total endpoint errors', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', 'full-key');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/query/total/')) {
        return new Response(null, { status: 500 });
      }
      if (url.includes('/query?')) {
        return Response.json([
          { playbackId: 'playback-1', viewCount: 11, playtimeMins: 4 },
        ]);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: true,
      metrics: {
        playbackId: 'playback-1',
        viewCount: 11,
        playtimeMins: 4,
        legacyViewCount: 0,
      },
    });
  });

  it('uses query fallback with a standard API key when /total is zero', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', '');
    vi.stubEnv('LIVEPEER_API_KEY', 'standard-key');
    vi.mocked(getFullLivepeer).mockReturnValue(null);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/query/total/')) {
        return Response.json({ playbackId: 'playback-1', viewCount: 0, playtimeMins: 0 });
      }
      if (url.includes('/query?')) {
        return Response.json([
          { playbackId: 'playback-1', viewCount: 8, playtimeMins: 2 },
        ]);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: true,
      metrics: {
        playbackId: 'playback-1',
        viewCount: 8,
        playtimeMins: 2,
        legacyViewCount: 0,
      },
    });
  });

  it('returns upstream_error when Livepeer responds with errors in JSON body', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', 'full-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ errors: [['id not provided', 'Account not found']] }),
      ),
    );

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: false,
      reason: 'upstream_error',
      status: 200,
    });
  });

  it('returns upstream_error when Livepeer responds with 500', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', 'full-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500, statusText: 'Internal Server Error' })),
    );

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: false,
      reason: 'upstream_error',
      status: 500,
    });
  });

  it('returns not_configured when no API key is set', async () => {
    vi.stubEnv('LIVEPEER_FULL_API_KEY', '');
    vi.stubEnv('LIVEPEER_API_KEY', '');

    await expect(fetchAllViews('playback-1')).resolves.toEqual({
      ok: false,
      reason: 'not_configured',
    });
  });
});
