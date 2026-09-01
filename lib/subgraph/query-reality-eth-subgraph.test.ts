import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { queryRealityEthSubgraph } from './query-reality-eth-subgraph';

describe('queryRealityEthSubgraph', () => {
  const env = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...env };
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = env;
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns data from the client proxy on success', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
    const mockData = { answers: [{ answer: '0x01' }] };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    } as Response);

    const result = await queryRealityEthSubgraph<{ answers: unknown[] }>(
      'query { answers { answer } }',
      { qId: '0xabc' },
    );

    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      'https://app.example.com/api/reality-eth-subgraph',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns null when the client proxy responds with GraphQL errors', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'deployment does not exist' }] }),
    } as Response);

    const result = await queryRealityEthSubgraph('query { answers { answer } }');
    expect(result).toBeNull();
  });

  it('uses studio endpoint server-side when configured', async () => {
    process.env.SUBGRAPH_PROVIDER_MODE = 'studio';
    process.env.GRAPH_STUDIO_CREATIVE_PLATFORM_URL =
      'https://gateway.thegraph.com/api/test/subgraphs/id/test';
    const mockData = { answers: [] };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    } as Response);

    const result = await queryRealityEthSubgraph<{ answers: unknown[] }>(
      'query { answers { answer } }',
    );

    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      process.env.GRAPH_STUDIO_CREATIVE_PLATFORM_URL,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
