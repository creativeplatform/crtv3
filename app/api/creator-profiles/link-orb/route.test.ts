import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TOKEN_LENS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_LENS = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const OWNER = '0xcccccccccccccccccccccccccccccccccccccccc';
const STALE_OWNER = '0xdddddddddddddddddddddddddddddddddddddddd';
const ORB_AUTH_ID = 'orb-auth-123';

const mockGetAccountFromAccessToken = vi.fn();
const mockRequireWalletAuthFor = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdateIn = vi.fn();
const mockUpsert = vi.fn();

vi.mock('botid/server', () => ({
  checkBotId: vi.fn(async () => ({ isBot: false })),
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  rateLimiters: {
    generous: vi.fn(async () => null),
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
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      update: () => ({
        in: mockUpdateIn,
      }),
      upsert: mockUpsert,
    }),
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn() },
}));

import { POST } from './route';
import { WalletAuthError } from '@/lib/auth/require-wallet';

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
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpdateIn.mockResolvedValue({ error: null });
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

  it('clears stale orb link on another profile before upserting', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { owner_address: STALE_OWNER },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      linkOrbRequest({
        accessToken: 'valid-token',
        authenticationId: ORB_AUTH_ID,
        owner_address: OWNER,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockUpdateIn).toHaveBeenCalledWith('owner_address', [STALE_OWNER]);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_address: OWNER,
        orb_account_id: ORB_AUTH_ID,
      }),
      { onConflict: 'owner_address' },
    );
  });

  it('returns 401 when wallet signature verification fails', async () => {
    mockRequireWalletAuthFor.mockRejectedValue(
      new WalletAuthError(401, 'Invalid wallet signature'),
    );

    const response = await POST(
      linkOrbRequest({
        accessToken: 'valid-token',
        owner_address: OWNER,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid wallet signature');
  });

  it('returns 409 with friendly message on duplicate orb_account_id upsert', async () => {
    mockUpsert.mockReturnValue({
      select: () => ({
        single: async () => ({
          data: null,
          error: {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "creator_profiles_orb_account_id_key"',
          },
        }),
      }),
    });

    const response = await POST(
      linkOrbRequest({
        accessToken: 'valid-token',
        owner_address: OWNER,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.success).toBe(false);
    expect(json.error).toContain('already linked');
  });
});
