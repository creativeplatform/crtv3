import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { supabaseService } from '@/lib/sdk/supabase/service';
import { createClient } from '@/lib/sdk/supabase/server';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { requireWalletAuthFor, WalletAuthError } from '@/lib/auth/require-wallet';

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    // Handle JSON parsing errors
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      serverLogger.error('Invalid JSON in request body:', jsonError);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body'
        },
        { status: 400 }
      );
    }

    const {
      owner_address,
      username,
      bio,
      avatar_url,
      twin_enabled,
      twin_address,
      twin_avatar_glb_url,
      twin_chat_endpoint,
    } = body;

    if (!owner_address) {
      return NextResponse.json(
        { success: false, error: 'owner_address is required' },
        { status: 400 }
      );
    }

    // Verify the caller actually controls owner_address. Without this, any
    // client could overwrite any other creator's profile.
    try {
      await requireWalletAuthFor(request, owner_address);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { success: false, error: authErr.message },
          { status: authErr.status }
        );
      }
      throw authErr;
    }

    // Build the update payload, only including fields the caller provided so
    // we don't overwrite existing values (e.g. twin fields) with undefined.
    const payload: Record<string, unknown> = {
      owner_address: owner_address.toLowerCase(),
      updated_at: new Date().toISOString(),
    };
    if (username !== undefined) payload.username = username;
    if (bio !== undefined) payload.bio = bio;
    if (avatar_url !== undefined) payload.avatar_url = avatar_url;
    if (twin_enabled !== undefined) payload.twin_enabled = twin_enabled;
    if (twin_address !== undefined) {
      payload.twin_address = twin_address ? String(twin_address).toLowerCase() : null;
    }
    if (twin_avatar_glb_url !== undefined) payload.twin_avatar_glb_url = twin_avatar_glb_url;
    if (twin_chat_endpoint !== undefined) payload.twin_chat_endpoint = twin_chat_endpoint;

    let data, error;

    // Try service role client first (bypasses RLS)
    if (supabaseService) {
      const result = await supabaseService
        .from('creator_profiles')
        .upsert(payload, { onConflict: 'owner_address' })
        .select();

      data = result.data;
      error = result.error;
    } else {
      // Fallback to regular client (may fail due to RLS)
      const supabase = await createClient();
      const result = await supabase
        .from('creator_profiles')
        .upsert(payload, { onConflict: 'owner_address' })
        .select();

      data = result.data;
      error = result.error;
    }

    if (error) {
      serverLogger.error('Supabase upsert error:', error);
      
      // Provide helpful error message for RLS issues
      if (error.message.includes('row-level security policy')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'RLS policy violation. Please configure SUPABASE_SERVICE_ROLE_KEY environment variable or update RLS policies. ' +
              'See SUPABASE_RLS_SOLUTION.md for details.' 
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to upsert creator profile: ${error.message}` 
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No data returned from upsert operation' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: data[0] 
    });
  } catch (error) {
    serverLogger.error('Error upserting creator profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to upsert creator profile' 
      },
      { status: 500 }
    );
  }
}