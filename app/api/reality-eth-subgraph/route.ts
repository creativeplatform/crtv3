import { NextRequest, NextResponse } from 'next/server';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import {
  asGraphQlRequestBody,
  buildSubgraphRequestHeaders,
  formatGraphQlErrors,
  getGraphQlResponseErrors,
  getSubgraphProviderMode,
  GOLDSKY_ROLLBACK_HINT,
  isGraphQlResponseSuccessful,
  resolveSubgraphEndpoints,
  STUDIO_URL_HINT,
} from '@/lib/subgraph/creative-platform-proxy';

export async function POST(request: NextRequest) {
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  try {
    const rawBody = await request.json();
    const body = asGraphQlRequestBody(rawBody);
    serverLogger.debug('Reality.eth subgraph proxy received request:', {
      query: body.query?.substring(0, 100) + '...',
      variables: body.variables,
      providerMode: getSubgraphProviderMode(),
    });

    const candidateEndpoints = resolveSubgraphEndpoints('reality-eth');

    if (candidateEndpoints.length === 0) {
      return NextResponse.json(
        {
          error: 'Reality.eth Subgraph Not Configured',
          hint: STUDIO_URL_HINT,
        },
        { status: 503 },
      );
    }

    let lastHttpError: { status: number; details: string; endpoint: string } | null = null;
    let lastGraphQlError: { message: string; endpoint: string } | null = null;

    for (const endpoint of candidateEndpoints) {
      const headers = buildSubgraphRequestHeaders(endpoint);
      serverLogger.debug(`Forwarding Reality.eth query to endpoint: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(rawBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastHttpError = { status: response.status, details: errorText, endpoint };
        serverLogger.error('Reality.eth subgraph HTTP error:', lastHttpError);
        continue;
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch (jsonError) {
        lastHttpError = {
          status: response.status,
          details: 'Failed to parse JSON response',
          endpoint,
        };
        serverLogger.error('Reality.eth subgraph JSON parse error:', jsonError);
        continue;
      }

      if (!isGraphQlResponseSuccessful(data)) {
        const message = formatGraphQlErrors(getGraphQlResponseErrors(data));
        lastGraphQlError = { message, endpoint };
        serverLogger.error('Reality.eth subgraph GraphQL error:', { endpoint, message });
        continue;
      }

      const payload = data as { data: Record<string, unknown> };

      serverLogger.debug('Reality.eth subgraph query successful:', {
        endpoint,
        dataKeys: payload.data ? Object.keys(payload.data) : [],
      });

      return NextResponse.json(data);
    }

    if (lastGraphQlError) {
      const isDeploymentMissing = lastGraphQlError.message.toLowerCase().includes('does not exist');
      return NextResponse.json(
        {
          errors: [{ message: lastGraphQlError.message }],
          hint: isDeploymentMissing
            ? `${STUDIO_URL_HINT} ${GOLDSKY_ROLLBACK_HINT}`
            : 'Subgraph query failed. Verify Graph Studio deployment is synced.',
        },
        { status: 502 },
      );
    }

    if (lastHttpError) {
      return NextResponse.json(
        {
          error: 'Reality.eth Subgraph Query Failed',
          details: lastHttpError.details,
          status: lastHttpError.status,
          hint:
            lastHttpError.status === 404
              ? STUDIO_URL_HINT
              : lastHttpError.status === 429
                ? 'Rate limit exceeded. Please try again later.'
                : 'Subgraph server error. The selected provider may be down or misconfigured.',
        },
        { status: lastHttpError.status },
      );
    }

    return NextResponse.json(
      { error: 'No subgraph endpoint available', hint: STUDIO_URL_HINT },
      { status: 503 },
    );
  } catch (error) {
    serverLogger.error('Error proxying Reality.eth subgraph request:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: STUDIO_URL_HINT,
      },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    },
  });
}
