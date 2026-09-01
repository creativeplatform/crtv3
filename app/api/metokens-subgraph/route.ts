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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid Request Body',
        message: 'Failed to parse request body as JSON',
      },
      { status: 400 },
    );
  }

  try {
    const bodyObj = asGraphQlRequestBody(body);
    serverLogger.debug('Subgraph proxy received request:', {
      query: bodyObj.query?.substring(0, 100) + '...',
      variables: bodyObj.variables,
      providerMode: getSubgraphProviderMode(),
    });

    const candidateEndpoints = resolveSubgraphEndpoints('metokens');

    if (candidateEndpoints.length === 0) {
      return NextResponse.json(
        {
          error: 'MeTokens Subgraph Not Configured',
          hint: STUDIO_URL_HINT,
        },
        { status: 503 },
      );
    }

    let lastHttpError: { status: number; details: string; endpoint: string } | null = null;
    let lastGraphQlError: { message: string; endpoint: string } | null = null;

    for (const endpoint of candidateEndpoints) {
      const headers = buildSubgraphRequestHeaders(endpoint);
      serverLogger.debug(`Forwarding MeTokens query to endpoint: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastHttpError = { status: response.status, details: errorText, endpoint };
        serverLogger.error('MeTokens subgraph HTTP error:', lastHttpError);
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
        serverLogger.error('MeTokens subgraph JSON parse error:', jsonError);
        continue;
      }

      if (!isGraphQlResponseSuccessful(data)) {
        const message = formatGraphQlErrors(getGraphQlResponseErrors(data));
        lastGraphQlError = { message, endpoint };
        serverLogger.error('MeTokens subgraph GraphQL error:', { endpoint, message });
        continue;
      }

      const payload = data as { data: Record<string, unknown> };

      serverLogger.debug('Subgraph query successful:', {
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
          error: 'Subgraph Query Failed',
          details: lastHttpError.details,
          status: lastHttpError.status,
          hint:
            lastHttpError.status === 404
              ? STUDIO_URL_HINT
              : lastHttpError.status === 429
                ? 'Rate limit exceeded. Please try again later.'
                : 'Subgraph server error.',
        },
        { status: lastHttpError.status },
      );
    }

    return NextResponse.json(
      { error: 'No subgraph endpoint available', hint: STUDIO_URL_HINT },
      { status: 503 },
    );
  } catch (error) {
    serverLogger.error('Error proxying subgraph request:', error);

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
