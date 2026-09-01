import { describe, expect, it, vi, beforeEach } from 'vitest';

const fetchAppMock = vi.fn();
const fetchAppFeedsMock = vi.fn();
const fetchFeedMock = vi.fn();

vi.mock('@lens-protocol/client/actions', () => ({
  fetchApp: (...args: unknown[]) => fetchAppMock(...args),
  fetchAppFeeds: (...args: unknown[]) => fetchAppFeedsMock(...args),
  fetchFeed: (...args: unknown[]) => fetchFeedMock(...args),
}));

vi.mock('@/lib/sdk/lens/create-client', () => ({
  createLensClient: () => ({}),
}));

import { resolveSongchainConfig } from './resolve-lens-app';
import type { SongchainConfig } from './config';

const baseConfig: SongchainConfig = {
  enabled: true,
  appId: null,
  publicFeedId: null,
  exclusiveFeedId: null,
  groupId: null,
  graphId: null,
  hallidayApiKey: null,
  hallidayOutputAsset: 'lens:0x0',
  hallidayInputAssets: ['usd'],
  hallidaySandbox: false,
  season2Enabled: false,
  season2PublicFeedId: null,
  season2ExclusiveFeedId: null,
  season2LockAddress: null,
};

describe('resolveSongchainConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects app address mistakenly set as public feed id', async () => {
    const app = '0x3412c2509eef4f9a133e6d3638b9b3c06fc30111';
    const defaultFeed = '0x3c336f772167d789d8f781a7002c33451120d74d';
    const publicFeed = '0xcb5e109ffc0e15565082d78e68dddf2573703580';

    fetchFeedMock.mockImplementation(async (_client, req) => ({
      isOk: () => true,
      isErr: () => false,
      value:
        String(req.feed).toLowerCase() === defaultFeed
          ? { address: defaultFeed }
          : null,
    }));
    fetchAppMock.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: {
        defaultFeedAddress: defaultFeed,
        graphAddress: '0x2b36706e8e352a273c34d108a5854a55cb2302a6',
      },
    });
    fetchAppFeedsMock.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: {
        items: [{ feed: defaultFeed }, { feed: publicFeed }],
      },
    });

    const resolved = await resolveSongchainConfig({
      ...baseConfig,
      publicFeedId: app,
      exclusiveFeedId: defaultFeed,
    });

    expect(resolved.appId).toBe(app);
    expect(resolved.publicFeedId).toBe(publicFeed);
    expect(resolved.exclusiveFeedId).toBe(defaultFeed);
    expect(resolved.resolutionNotes.some((n) => n.includes('app address'))).toBe(true);
  });

  it('resolves graph from app when graph id is omitted', async () => {
    const app = '0x3412c2509eef4f9a133e6d3638b9b3c06fc30111';
    const graph = '0x2b36706e8e352a273c34d108a5854a55cb2302a6';

    fetchFeedMock.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { address: '0xfeed' },
    });
    fetchAppMock.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: {
        defaultFeedAddress: '0xfeed',
        graphAddress: graph,
      },
    });
    fetchAppFeedsMock.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { items: [{ feed: '0xfeed' }] },
    });

    const resolved = await resolveSongchainConfig({
      ...baseConfig,
      appId: app,
    });

    expect(resolved.graphId).toBe(graph);
    expect(resolved.resolutionNotes.some((n) => n.includes('graph'))).toBe(true);
  });

  it('marks config disabled when only app id is set and fetchApp fails', async () => {
    const app = '0x3412c2509eef4f9a133e6d3638b9b3c06fc30111';

    fetchAppMock.mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      value: null,
    });

    const resolved = await resolveSongchainConfig({
      ...baseConfig,
      enabled: true,
      appId: app,
    });

    expect(resolved.enabled).toBe(false);
    expect(resolved.publicFeedId).toBeNull();
    expect(resolved.resolutionNotes.some((n) => n.includes('not found'))).toBe(true);
  });

  it('marks config disabled when only app id is set and fetchApp throws', async () => {
    const app = '0x3412c2509eef4f9a133e6d3638b9b3c06fc30111';

    fetchAppMock.mockRejectedValue(new Error('network timeout'));

    const resolved = await resolveSongchainConfig({
      ...baseConfig,
      enabled: true,
      appId: app,
    });

    expect(resolved.enabled).toBe(false);
    expect(resolved.resolutionNotes.some((n) => n.includes('network error'))).toBe(true);
  });

  it('treats lens existence check failures as missing', async () => {
    fetchFeedMock.mockRejectedValue(new Error('network timeout'));

    const resolved = await resolveSongchainConfig({
      ...baseConfig,
      publicFeedId: '0xabc0000000000000000000000000000000000001',
    });

    expect(resolved.appId).toBeNull();
    expect(resolved.publicFeedId).toBe(
      '0xabc0000000000000000000000000000000000001',
    );
  });
});
