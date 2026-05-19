import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

// MeTokens subgraph endpoint - now using Goldsky
// Deployment ID: QmVaWYhk4HKhk9rNQi11RKujTVS4KHF1uHGNVUF4f7xJ53
const DEFAULT_PROJECT_ID = 'project_cmh0iv6s500dbw2p22vsxcfo6';
const PROJECT_ID = process.env.GOLDSKY_PROJECT_ID || DEFAULT_PROJECT_ID;

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

  // Read body once at the start so we can reuse it in error handlers
  let body: any;
  try {
    body = await request.json();
  } catch (parseError) {
    return NextResponse.json(
      {
        error: 'Invalid Request Body',
        message: 'Failed to parse request body as JSON',
      },
      { status: 400 }
    );
  }

  try {
    serverLogger.debug('Subgraph proxy received request:', {
      query: body.query?.substring(0, 100) + '...',
      variables: body.variables,
    });

    const providerMode = getProviderMode();
    const studioEndpoint = getStudioUrl();

    // Determine Goldsky endpoints
    const isPrivate = !!process.env.GOLDSKY_API_KEY;
    const privateEndpoint = getSubgraphUrl('metokens', '1.0.2', 'private');
    const publicEndpoint = getSubgraphUrl('metokens', '1.0.2', 'public');
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
      response = await performFetch(endpoint, endpointHeaders);
      if (response.ok) break;
    }

    if (!response) throw new Error('No subgraph endpoint available');


    serverLogger.debug('Subgraph response status:', response.status);

    if (!response.ok) {
      // Use stored error text if available, otherwise read from response
      const errorText = await response.text();
      serverLogger.error('Subgraph request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      return NextResponse.json(
        {
          error: 'Subgraph Query Failed',
          details: errorText,
          status: response.status,
          hint: response.status === 404
            ? 'Subgraph not found. Verify Studio URL or Goldsky deployment details.'
            : response.status === 429
              ? 'Rate limit exceeded. Please try again later.'
              : 'Subgraph server error.',
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Check for GraphQL errors in the response
    if (data.errors && data.errors.length > 0) {
      serverLogger.error('GraphQL errors in response:', data.errors);
      return NextResponse.json(data); // Return errors to client
    }

    serverLogger.debug('Subgraph query successful:', {
      hasData: !!data.data,
      dataKeys: data.data ? Object.keys(data.data) : [],
    });

    return NextResponse.json(data);

  } catch (error) {
    serverLogger.error('Error proxying subgraph request:', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Check server logs for more details. Using Goldsky (Deployment ID: QmVaWYhk4HKhk9rNQi11RKujTVS4KHF1uHGNVUF4f7xJ53).',
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
