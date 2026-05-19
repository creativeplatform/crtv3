import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

// Reality.eth subgraph endpoint - using Goldsky
// Public URL: https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/reality-eth/1.0.0/gn
// Uses the same project as MeTokens subgraphs
// Set GOLDSKY_REALITY_ETH_PROJECT_ID environment variable to use a different project
const DEFAULT_PROJECT_ID = 'project_cmh0iv6s500dbw2p22vsxcfo6';
const PROJECT_ID = process.env.GOLDSKY_REALITY_ETH_PROJECT_ID || DEFAULT_PROJECT_ID;

const getSubgraphUrl = (subgraphName: string, version: string, specificAccessType?: 'public' | 'private') => {
  const isPrivate = !!process.env.GOLDSKY_API_KEY;
  const accessType = specificAccessType || (isPrivate ? 'private' : 'public');
  return `https://api.goldsky.com/api/${accessType}/${PROJECT_ID}/subgraphs/${subgraphName}/${version}/gn`;
};

type ProviderMode = 'goldsky' | 'studio' | 'dual';

const getProviderMode = (): ProviderMode => {
  const rawMode = process.env.SUBGRAPH_PROVIDER_MODE?.toLowerCase();
  if (rawMode === 'studio' || rawMode === 'dual' || rawMode === 'goldsky') return rawMode;
  return 'goldsky';
};

const getStudioUrl = () => process.env.GRAPH_STUDIO_CREATIVE_PLATFORM_URL;

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  try {
    const body = await request.json();
    serverLogger.debug('Reality.eth subgraph proxy received request:', {
      query: body.query?.substring(0, 100) + '...',
      variables: body.variables,
    });

    const providerMode = getProviderMode();
    const studioEndpoint = getStudioUrl();

    // Determine Goldsky endpoints
    const isPrivate = !!process.env.GOLDSKY_API_KEY;
    const privateEndpoint = getSubgraphUrl('reality-eth', '1.0.0', 'private');
    const publicEndpoint = getSubgraphUrl('reality-eth', '1.0.0', 'public');
    const goldskyPrimary = isPrivate ? privateEndpoint : publicEndpoint;

    const candidateEndpoints: string[] = [];
    if (providerMode === 'studio' || providerMode === 'dual') {
      if (studioEndpoint) candidateEndpoints.push(studioEndpoint);
    }
    if (providerMode === 'goldsky' || providerMode === 'dual' || !studioEndpoint) {
      candidateEndpoints.push(goldskyPrimary);
    }
    if (isPrivate) candidateEndpoints.push(publicEndpoint);

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (isPrivate && process.env.GOLDSKY_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.GOLDSKY_API_KEY}`;
    }

    // Helper to perform fetch
    const performFetch = async (url: string, headers: Record<string, string>) => {
      return fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    };

    if (candidateEndpoints.length === 0) {
      throw new Error('No subgraph endpoints configured. Set GRAPH_STUDIO_CREATIVE_PLATFORM_URL or Goldsky variables.');
    }

    let response: Response | null = null;
    let subgraphEndpoint = '';
    for (const endpoint of candidateEndpoints) {
      subgraphEndpoint = endpoint;
      const endpointHeaders = endpoint.includes('goldsky.com') ? headers : { 'Content-Type': 'application/json' };
      if (!endpoint.includes('goldsky.com') && endpointHeaders['Authorization']) {
        delete endpointHeaders['Authorization'];
      }
      serverLogger.debug(`Forwarding Reality.eth query to endpoint: ${endpoint}`);
      response = await performFetch(endpoint, endpointHeaders);
      // Try every candidate until one succeeds. (Previous logic stopped on any 4xx,
      // so a misconfigured Graph Studio URL blocked Goldsky fallback entirely.)
      if (response.ok) break;
    }

    if (!response) throw new Error('No subgraph endpoint available');

    serverLogger.debug('Reality.eth subgraph response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      serverLogger.error('Goldsky Reality.eth subgraph request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      return NextResponse.json(
        {
          error: 'Reality.eth Subgraph Query Failed',
          details: errorText,
          status: response.status,
          hint: response.status === 404
            ? 'Subgraph not found. Verify Studio URL or Goldsky deployment details.'
            : response.status === 429
              ? 'Rate limit exceeded. Please try again later.'
              : 'Subgraph server error. The selected provider may be down or misconfigured.',
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Check for GraphQL errors in the response
    if (data.errors && data.errors.length > 0) {
      serverLogger.error('GraphQL errors in response:', data.errors);
      return NextResponse.json(data);
    }

    serverLogger.debug('Reality.eth subgraph query successful:', {
      hasData: !!data.data,
      dataKeys: data.data ? Object.keys(data.data) : [],
    });

    return NextResponse.json(data);

  } catch (error) {
    serverLogger.error('Error proxying Reality.eth subgraph request:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Check server logs for more details. Ensure the Reality.eth subgraph is deployed to Goldsky.',
      },
      { status: 500 }
    );
  }
}

// Handle preflight requests for CORS
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
