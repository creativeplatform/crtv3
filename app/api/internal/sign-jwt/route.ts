import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { handleSignJwt } from '@/lib/livepeer/sign-jwt-handler';

/**
 * Internal, first-party signed-JWT endpoint used by the in-app video player.
 * Not gated by BotID deep analysis — only rate-limited.
 * External consumers should use /api/livepeer/sign-jwt.
 */
export async function POST(req: NextRequest) {
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  return handleSignJwt(req);
}
