/**
 * Shared routing for the merged creative-platform subgraph (Graph Studio + optional Goldsky rollback).
 */

export type SubgraphProviderMode = 'goldsky' | 'studio' | 'dual';

const DEFAULT_GOLDSKY_PROJECT_ID = 'project_cmh0iv6s500dbw2p22vsxcfo6';

/** Goldsky MeTokens subgraph version (Studio deploy tag should match). */
export const METOKENS_GOLDSKY_VERSION = '1.0.3';

export function getSubgraphProviderMode(): SubgraphProviderMode {
  const rawMode = process.env.SUBGRAPH_PROVIDER_MODE?.toLowerCase();
  if (rawMode === 'studio' || rawMode === 'dual' || rawMode === 'goldsky') return rawMode;
  return 'studio';
}

export function getStudioSubgraphUrl(): string | undefined {
  return process.env.GRAPH_STUDIO_CREATIVE_PLATFORM_URL?.trim() || undefined;
}

function getGoldskyProjectId(realityEth = false): string {
  if (realityEth && process.env.GOLDSKY_REALITY_ETH_PROJECT_ID) {
    return process.env.GOLDSKY_REALITY_ETH_PROJECT_ID;
  }
  return process.env.GOLDSKY_PROJECT_ID || DEFAULT_GOLDSKY_PROJECT_ID;
}

function getGoldskyUrl(
  subgraphName: string,
  version: string,
  realityEth = false,
  accessType?: 'public' | 'private',
): string {
  const isPrivate = !!process.env.GOLDSKY_API_KEY;
  const resolvedAccess = accessType ?? (isPrivate ? 'private' : 'public');
  const projectId = getGoldskyProjectId(realityEth);
  return `https://api.goldsky.com/api/${resolvedAccess}/${projectId}/subgraphs/${subgraphName}/${version}/gn`;
}

export type SubgraphProxyTarget = 'metokens' | 'reality-eth';

export function resolveSubgraphEndpoints(target: SubgraphProxyTarget): string[] {
  const mode = getSubgraphProviderMode();
  const studioUrl = getStudioSubgraphUrl();
  const isPrivate = !!process.env.GOLDSKY_API_KEY;

  const goldskyPrimary =
    target === 'reality-eth'
      ? getGoldskyUrl('reality-eth', '1.0.0', true, isPrivate ? 'private' : 'public')
      : getGoldskyUrl('metokens', METOKENS_GOLDSKY_VERSION, false, isPrivate ? 'private' : 'public');

  const goldskyPublicFallback =
    target === 'reality-eth'
      ? getGoldskyUrl('reality-eth', '1.0.0', true, 'public')
      : getGoldskyUrl('metokens', METOKENS_GOLDSKY_VERSION, false, 'public');

  const endpoints: string[] = [];

  if (mode === 'studio' || mode === 'dual') {
    if (studioUrl) endpoints.push(studioUrl);
  }
  if (mode === 'goldsky' || mode === 'dual' || !studioUrl) {
    endpoints.push(goldskyPrimary);
  }
  if (isPrivate && mode !== 'studio') {
    endpoints.push(goldskyPublicFallback);
  }

  return endpoints;
}

export function buildSubgraphRequestHeaders(endpoint: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (endpoint.includes('goldsky.com') && process.env.GOLDSKY_API_KEY) {
    headers.Authorization = `Bearer ${process.env.GOLDSKY_API_KEY}`;
  }
  return headers;
}

export function isGraphQlResponseSuccessful(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const payload = data as { data?: unknown; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) return false;
  return payload.data != null;
}

export function getGraphQlResponseErrors(data: unknown): Array<{ message?: string }> {
  if (data && typeof data === 'object' && Array.isArray((data as { errors?: unknown }).errors)) {
    return (data as { errors: Array<{ message?: string }> }).errors;
  }
  return [{ message: 'Invalid or empty GraphQL response' }];
}

export function asGraphQlRequestBody(body: unknown): { query?: string; variables?: unknown } {
  return body && typeof body === 'object'
    ? (body as { query?: string; variables?: unknown })
    : {};
}

export function formatGraphQlErrors(errors: Array<{ message?: string }>): string {
  return errors.map((e) => e.message ?? 'Unknown GraphQL error').join('; ');
}

export const STUDIO_URL_HINT =
  'Redeploy subgraphs/creative-platform to Graph Studio and set GRAPH_STUDIO_CREATIVE_PLATFORM_URL.';

export const GOLDSKY_ROLLBACK_HINT =
  'For emergency rollback, set SUBGRAPH_PROVIDER_MODE=goldsky in environment variables.';
