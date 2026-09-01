import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  getSubgraphProviderMode,
  isGraphQlResponseSuccessful,
  resolveSubgraphEndpoints,
} from './creative-platform-proxy';

describe('creative-platform-proxy', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('defaults SUBGRAPH_PROVIDER_MODE to studio', () => {
    delete process.env.SUBGRAPH_PROVIDER_MODE;
    expect(getSubgraphProviderMode()).toBe('studio');
  });

  it('studio mode uses only Graph Studio URL when configured', () => {
    process.env.SUBGRAPH_PROVIDER_MODE = 'studio';
    process.env.GRAPH_STUDIO_CREATIVE_PLATFORM_URL =
      'https://gateway.thegraph.com/api/test/subgraphs/id/test';
    const endpoints = resolveSubgraphEndpoints('reality-eth');
    expect(endpoints).toEqual([process.env.GRAPH_STUDIO_CREATIVE_PLATFORM_URL]);
  });

  it('goldsky mode does not require Studio URL', () => {
    process.env.SUBGRAPH_PROVIDER_MODE = 'goldsky';
    delete process.env.GRAPH_STUDIO_CREATIVE_PLATFORM_URL;
    const endpoints = resolveSubgraphEndpoints('reality-eth');
    expect(endpoints.length).toBeGreaterThan(0);
    expect(endpoints[0]).toContain('goldsky.com');
  });

  it('treats GraphQL errors as unsuccessful', () => {
    expect(
      isGraphQlResponseSuccessful({
        errors: [{ message: 'deployment does not exist' }],
        data: null,
      }),
    ).toBe(false);
  });

  it('rejects null or non-object GraphQL payloads', () => {
    expect(isGraphQlResponseSuccessful(null)).toBe(false);
    expect(isGraphQlResponseSuccessful('error')).toBe(false);
  });

  it('accepts valid GraphQL data', () => {
    expect(isGraphQlResponseSuccessful({ data: { questions: [] } })).toBe(true);
  });
});
