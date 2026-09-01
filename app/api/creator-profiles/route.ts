import { NextRequest, NextResponse } from 'next/server';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import { supabaseService } from '@/lib/sdk/supabase/service';
import { createClient } from '@/lib/sdk/supabase/server';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const search = searchParams.get('search');
    
    // Clamp limit and offset to safe integer values
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    if (owner) {
      // Get specific creator profile by owner address
      let data, error;
      
      if (supabaseService) {
        const result = await supabaseService
          .from('creator_profiles')
          .select('*')
          .eq('owner_address', owner.toLowerCase())
          .single();
        data = result.data;
        error = result.error;
      } else {
        const supabase = await createClient();
        const result = await supabase
          .from('creator_profiles')
          .select('*')
          .eq('owner_address', owner.toLowerCase())
          .single();
        data = result.data;
        error = result.error;
      }
      
      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ 
            success: true, 
            data: null 
          });
        }
        throw new Error(`Failed to fetch creator profile: ${error.message}`);
      }
      
      return NextResponse.json({ 
        success: true, 
        data: data 
      });
    } else if (search) {
      // Search creator profiles
      let data, error;
      
      if (supabaseService) {
        const result = await supabaseService
          .from('creator_profiles')
          .select('*')
          .or(`username.ilike.%${search}%,bio.ilike.%${search}%`)
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;
      } else {
        const supabase = await createClient();
        const result = await supabase
          .from('creator_profiles')
          .select('*')
          .or(`username.ilike.%${search}%,bio.ilike.%${search}%`)
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;
      }
      
      if (error) {
        throw new Error(`Failed to search creator profiles: ${error.message}`);
      }
      
      return NextResponse.json({ 
        success: true, 
        data: data || [] 
      });
    } else {
      // Get all creator profiles with pagination
      let data, error;
      
      if (supabaseService) {
        const result = await supabaseService
          .from('creator_profiles')
          .select('*')
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;
      } else {
        const supabase = await createClient();
        const result = await supabase
          .from('creator_profiles')
          .select('*')
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;
      }
      
      if (error) {
        throw new Error(`Failed to fetch creator profiles: ${error.message}`);
      }
      
      return NextResponse.json({ 
        success: true, 
        data: data || [] 
      });
    }
  } catch (error) {
    serverLogger.error('Error fetching creator profiles:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch creator profiles' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
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
    
    const { owner_address, username, bio, avatar_url } = body;

    if (!owner_address) {
      return NextResponse.json(
        { success: false, error: 'owner_address is required' },
        { status: 400 }
      );
    }

    let data, error;
    
    if (supabaseService) {
      const result = await supabaseService
        .from('creator_profiles')
        .insert({
          owner_address: owner_address.toLowerCase(),
          username,
          bio,
          avatar_url,
        })
        .select();
      data = result.data;
      error = result.error;
    } else {
      const supabase = await createClient();
      const result = await supabase
        .from('creator_profiles')
        .insert({
          owner_address: owner_address.toLowerCase(),
          username,
          bio,
          avatar_url,
        })
        .select();
      data = result.data;
      error = result.error;
    }

    if (error) {
      throw new Error(`Failed to create creator profile: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No data returned from create operation');
    }

    return NextResponse.json({ 
      success: true, 
      data: data[0] 
    });
  } catch (error) {
    serverLogger.error('Error creating creator profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create creator profile' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const verification = await checkBotIdDeep();
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
    
    const { owner_address, username, bio, avatar_url } = body;

    if (!owner_address) {
      return NextResponse.json(
        { success: false, error: 'owner_address is required' },
        { status: 400 }
      );
    }

    let data, error;
    
    if (supabaseService) {
      const result = await supabaseService
        .from('creator_profiles')
        .upsert({
          owner_address: owner_address.toLowerCase(),
          username,
          bio,
          avatar_url,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'owner_address'
        })
        .select();
      data = result.data;
      error = result.error;
    } else {
      const supabase = await createClient();
      const result = await supabase
        .from('creator_profiles')
        .upsert({
          owner_address: owner_address.toLowerCase(),
          username,
          bio,
          avatar_url,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'owner_address'
        })
        .select();
      data = result.data;
      error = result.error;
    }

    if (error) {
      throw new Error(`Failed to update creator profile: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No data returned from update operation');
    }

    return NextResponse.json({ 
      success: true, 
      data: data[0] 
    });
  } catch (error) {
    serverLogger.error('Error updating creator profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update creator profile' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'owner parameter is required' },
        { status: 400 }
      );
    }

    let error;
    
    if (supabaseService) {
      const result = await supabaseService
        .from('creator_profiles')
        .delete()
        .eq('owner_address', owner.toLowerCase());
      error = result.error;
    } else {
      const supabase = await createClient();
      const result = await supabase
        .from('creator_profiles')
        .delete()
        .eq('owner_address', owner.toLowerCase());
      error = result.error;
    }

    if (error) {
      serverLogger.error('Delete operation failed:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to delete creator profile: ${error.message}` 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Creator profile deleted successfully' 
    });
  } catch (error) {
    serverLogger.error('Error deleting creator profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete creator profile' 
      },
      { status: 500 }
    );
  }
}

