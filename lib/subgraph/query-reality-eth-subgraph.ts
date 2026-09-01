import {
  buildSubgraphRequestHeaders,
  formatGraphQlErrors,
  getGraphQlResponseErrors,
  isGraphQlResponseSuccessful,
  resolveSubgraphEndpoints,
} from '@/lib/subgraph/creative-platform-proxy';

function getClientProxyUrl(): string {
  return `${window.location.origin}/api/reality-eth-subgraph`;
}

/**
 * Query the Reality.eth subgraph through the same routing as /api/reality-eth-subgraph
 * (Graph Studio, Goldsky, or dual mode per SUBGRAPH_PROVIDER_MODE).
 */
export async function queryRealityEthSubgraph<T extends Record<string, unknown>>(
  query: string | { loc?: { source: { body: string } } },
  variables: Record<string, unknown> = {},
): Promise<T | null> {
  const queryString = typeof query === "string" ? query : query.loc?.source.body ?? "";
  const body = JSON.stringify({ query: queryString, variables });

  if (typeof window !== 'undefined') {
    const response = await fetch(getClientProxyUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!response.ok) return null;

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return null;
    }

    if (!isGraphQlResponseSuccessful(payload)) return null;
    return (payload as { data: T }).data;
  }

  const endpoints = resolveSubgraphEndpoints('reality-eth');
  for (const endpoint of endpoints) {
    const headers = buildSubgraphRequestHeaders(endpoint);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
      });
      if (!response.ok) continue;

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        continue;
      }

      if (!isGraphQlResponseSuccessful(payload)) {
        const message = formatGraphQlErrors(getGraphQlResponseErrors(payload));
        if (message) continue;
      }

      return (payload as { data: T }).data;
    } catch {
      continue;
    }
  }

  return null;
}
