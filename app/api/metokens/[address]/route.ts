import { NextRequest, NextResponse } from 'next/server';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import { meTokenSupabaseService } from '@/lib/sdk/supabase/metokens';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

// GET /api/metokens/[address] - Get specific MeToken
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    if (!address) {
      return NextResponse.json(
        { error: 'MeToken address is required' },
        { status: 400 }
      );
    }

    const meToken = await meTokenSupabaseService.getMeTokenByAddress(address);
    
    if (!meToken) {
      return NextResponse.json(
        { error: 'MeToken not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: meToken });
  } catch (error) {
    serverLogger.error('Error fetching MeToken:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for database connection errors
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        return NextResponse.json(
          { 
            error: 'Database connection error',
            details: 'Unable to connect to the database. Please try again later.'
          },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch MeToken',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/metokens/[address] - Update MeToken data
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  let address: string | undefined;
  try {
    const resolvedParams = await params;
    address = resolvedParams.address;
    
    // Handle JSON parsing errors
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      serverLogger.error('Invalid JSON in request body:', jsonError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    if (!address) {
      return NextResponse.json(
        { error: 'MeToken address is required' },
        { status: 400 }
      );
    }

    const updateData = {
      total_supply: body.total_supply,
      tvl: body.tvl,
      balance_pooled: body.balance_pooled,
      balance_locked: body.balance_locked,
      end_time: body.end_time,
      end_cooldown: body.end_cooldown,
    };

    const result = await meTokenSupabaseService.updateMeToken(address, updateData);
    
    return NextResponse.json({ data: result });
  } catch (error) {
    serverLogger.error('Error updating MeToken:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for not found errors
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'MeToken not found',
            details: address ? `No MeToken found with address: ${address}` : 'MeToken not found'
          },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update MeToken',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
