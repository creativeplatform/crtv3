import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { getOrbLogin } from '@/lib/sdk/orb/login';
import { supabaseService } from '@/lib/sdk/supabase/service';
import { requireWalletAuthFor, WalletAuthError } from '@/lib/auth/require-wallet';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const accessToken = String(body.accessToken ?? '').trim();
    const ownerAddress = String(body.owner_address ?? '').trim().toLowerCase();
    const authenticationId = body.authentication_id
      ? String(body.authentication_id).trim()
      : body.authenticationId
        ? String(body.authenticationId).trim()
        : undefined;
    const lensAccountId = body.lens_account_id
      ? String(body.lens_account_id).trim().toLowerCase()
      : undefined;
    const lensHandle = body.lens_handle ? String(body.lens_handle).trim() : undefined;
    const lensAvatarUri = body.lens_avatar_uri
      ? String(body.lens_avatar_uri).trim()
      : undefined;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'accessToken is required' },
        { status: 400 },
      );
    }

    if (!ownerAddress) {
      return NextResponse.json(
        { success: false, error: 'owner_address is required' },
        { status: 400 },
      );
    }

    const orb = getOrbLogin();
    const lensFromToken = orb.getAccountFromAccessToken(accessToken);

    if (!lensFromToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid Orb access token' },
        { status: 401 },
      );
    }

    const resolvedLensAccount = lensFromToken.toLowerCase();

    if (lensAccountId && lensAccountId !== resolvedLensAccount) {
      return NextResponse.json(
        { success: false, error: 'lens_account_id mismatch with token' },
        { status: 400 },
      );
    }

    try {
      await requireWalletAuthFor(request, ownerAddress);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { success: false, error: authErr.message },
          { status: authErr.status },
        );
      }
      throw authErr;
    }

    if (!supabaseService) {
      return NextResponse.json(
        { success: false, error: 'Database service unavailable' },
        { status: 500 },
      );
    }

    const orbAccountId = authenticationId || resolvedLensAccount || ownerAddress;

    const payload: Record<string, unknown> = {
      owner_address: ownerAddress,
      orb_account_id: orbAccountId,
      lens_account_id: resolvedLensAccount,
      updated_at: new Date().toISOString(),
    };
    if (lensHandle) payload.lens_handle = lensHandle;
    if (lensAvatarUri) {
      payload.lens_avatar_uri = lensAvatarUri;
      if (!body.avatar_url) payload.avatar_url = lensAvatarUri;
    }

    const { data, error } = await supabaseService
      .from('creator_profiles')
      .upsert(payload, { onConflict: 'owner_address' })
      .select()
      .single();

    if (error) {
      serverLogger.error('[link-orb] upsert failed:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    serverLogger.error('[link-orb] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
