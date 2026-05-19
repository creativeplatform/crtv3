import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TOKEN_LENS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_LENS = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const OWNER = '0xcccccccccccccccccccccccccccccccccccccccc';

const mockGetAccountFromAccessToken = vi.fn();
const mockRequireWalletAuthFor = vi.fn();
const mockUpsert = vi.fn();

vi.mock('botid/server', () => ({
  checkBotId: vi.fn(async () => ({ isBot: false })),
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  rateLimiters: {
    standard: vi.fn(async () => null),
  },
}));

vi.mock('@/lib/sdk/orb/login', () => ({
  getOrbLogin: () => ({
    getAccountFromAccessToken: mockGetAccountFromAccessToken,
  }),
}));

vi.mock('@/lib/auth/require-wallet', () => ({
  requireWalletAuthFor: (...args: unknown[]) => mockRequireWalletAuthFor(...args),
  WalletAuthError: class WalletAuthError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
      this.name = 'WalletAuthError';
    }
  },
}));

vi.mock('@/lib/sdk/supabase/service', () => ({
  supabaseService: {
    from: () => ({
      upsert: mockUpsert,
    }),
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn() },
}));

import { POST } from './route';

function linkOrbRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/creator-profiles/link-orb', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('link-orb POST security', () => {
  beforeEach(() => {
    mockGetAccountFromAccessToken.mockReturnValue(TOKEN_LENS);
    mockRequireWalletAuthFor.mockResolvedValue({ address: OWNER });
    mockUpsert.mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { owner_address: OWNER, lens_account_id: TOKEN_LENS },
          error: null,
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Orb token has no Lens account', async () => {
    mockGetAccountFromAccessToken.mockReturnValue(null);

    const response = await POST(
      linkOrbRequest({
        accessToken: 'bad-token',
        owner_address: OWNER,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Invalid Orb access token');
    expect(mockRequireWalletAuthFor).not.toHaveBeenCalled();
  });

  it('returns 400 when body lens_account_id mismatches token', async () => {
    const response = await POST(
      linkOrbRequest({
        accessToken: 'valid-token',
        owner_address: OWNER,
        lens_account_id: OTHER_LENS,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('lens_account_id mismatch with token');
    expect(mockRequireWalletAuthFor).not.toHaveBeenCalled();
  });

  it('returns 400 when owner_address is missing', async () => {
    const response = await POST(
      linkOrbRequest({
        accessToken: 'valid-token',
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('owner_address is required');
  });

  it('links profile using token-verified Lens account on success', async () => {
    const response = await POST(
      linkOrbRequest({
        accessToken: 'valid-token',
        owner_address: OWNER,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockRequireWalletAuthFor).toHaveBeenCalledWith(
      expect.any(NextRequest),
      OWNER,
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_address: OWNER,
        lens_account_id: TOKEN_LENS.toLowerCase(),
      }),
      { onConflict: 'owner_address' },
    );
  });
});
