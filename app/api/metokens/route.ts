import { NextRequest, NextResponse } from 'next/server';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import { createClient } from '@/lib/sdk/supabase/server';
import { meTokenSupabaseService } from '@/lib/sdk/supabase/metokens';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

// GET /api/metokens - Get MeTokens with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const address = searchParams.get('address');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') as 'created_at' | 'tvl' | 'total_supply' || 'created_at';
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';

    let result;

    if (address) {
      // Get specific MeToken by address
      result = await meTokenSupabaseService.getMeTokenByAddress(address);
      return NextResponse.json({ data: result });
    } else if (owner) {
      // Get MeToken by owner
      result = await meTokenSupabaseService.getMeTokenByOwner(owner);
      return NextResponse.json({ data: result });
    } else if (search) {
      // Search MeTokens
      result = await meTokenSupabaseService.searchMeTokens(search, limit);
      return NextResponse.json({ data: result });
    } else {
      // Get all MeTokens with pagination
      result = await meTokenSupabaseService.getAllMeTokens({
        limit,
        offset,
        sortBy,
        sortOrder,
        search: search || undefined,
      });
      return NextResponse.json({ data: result });
    }
  } catch (error) {
    serverLogger.error('Error fetching MeTokens:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch MeToken')) {
        return NextResponse.json(
          { error: 'MeToken not found', data: null },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch MeTokens' },
      { status: 500 }
    );
  }
}

// POST /api/metokens - Create a new MeToken
export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    const supabase = await createClient();
    
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
    
    // Verify the user is authenticated (optional - depends on your auth setup)
    // const { data: { user }, error: authError } = await supabase.auth.getUser();
    // if (authError || !user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const {
      address,
      owner_address,
      name,
      symbol,
      total_supply,
      tvl,
      hub_id,
      balance_pooled,
      balance_locked,
      start_time,
      end_time,
      end_cooldown,
      target_hub_id,
      migration_address,
    } = body;

    // Validate required fields
    if (!address || !owner_address || !name || !symbol) {
      const missingFields = [];
      if (!address) missingFields.push('address');
      if (!owner_address) missingFields.push('owner_address');
      if (!name) missingFields.push('name');
      if (!symbol) missingFields.push('symbol');
      
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          missingFields,
          hint: 'All of the following fields are required: address, owner_address, name, symbol'
        },
        { status: 400 }
      );
    }

    const meTokenData = {
      address,
      owner_address,
      name,
      symbol,
      total_supply: total_supply || 0,
      tvl: tvl || 0,
      hub_id: hub_id || 1,
      balance_pooled: balance_pooled || 0,
      balance_locked: balance_locked || 0,
      start_time,
      end_time,
      end_cooldown,
      target_hub_id,
      migration_address,
    };

    const result = await meTokenSupabaseService.createMeToken(meTokenData);
    
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    serverLogger.error('Error creating MeToken:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for duplicate key errors (common in Supabase)
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
        return NextResponse.json(
          { 
            error: 'MeToken already exists',
            details: 'A MeToken with this address already exists in the database'
          },
          { status: 409 }
        );
      }
      
      // Check for validation errors
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return NextResponse.json(
          { 
            error: 'Validation error',
            details: error.message
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create MeToken',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
