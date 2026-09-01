import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEoaVerifyMessage = vi.fn();
const mockPrimaryVerifyMessage = vi.fn();
const mockFallbackVerifyMessage = vi.fn();

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    verifyMessage: (...args: unknown[]) => mockEoaVerifyMessage(...args),
  };
});

vi.mock('@/lib/viem', () => ({
  publicClient: {
    verifyMessage: (...args: unknown[]) => mockPrimaryVerifyMessage(...args),
  },
  fallbackPublicClient: {
    verifyMessage: (...args: unknown[]) => mockFallbackVerifyMessage(...args),
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  serverLogger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  buildWalletAuthMessage,
  getWalletAddressFromAuthHeaders,
  requireWalletAuth,
  verifyWalletSignature,
  walletAuthHeadersToArgs,
  WalletAuthError,
} from './require-wallet';

const ADDRESS = '0xcccccccccccccccccccccccccccccccccccccccc' as const;
const SIGNATURE = '0x1234' as const;

describe('verifyWalletSignature', () => {
  beforeEach(() => {
    mockEoaVerifyMessage.mockReset();
    mockPrimaryVerifyMessage.mockReset();
    mockFallbackVerifyMessage.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok when EOA verifyMessage succeeds without RPC', async () => {
    mockEoaVerifyMessage.mockResolvedValue(true);

    const result = await verifyWalletSignature(ADDRESS, 'hello', SIGNATURE);

    expect(result).toEqual({ ok: true });
    expect(mockPrimaryVerifyMessage).not.toHaveBeenCalled();
    expect(mockFallbackVerifyMessage).not.toHaveBeenCalled();
  });

  it('falls back to primary RPC for smart-account signatures', async () => {
    mockEoaVerifyMessage.mockResolvedValue(false);
    mockPrimaryVerifyMessage.mockResolvedValue(true);

    const result = await verifyWalletSignature(ADDRESS, 'hello', SIGNATURE);

    expect(result).toEqual({ ok: true });
    expect(mockPrimaryVerifyMessage).toHaveBeenCalledOnce();
    expect(mockFallbackVerifyMessage).not.toHaveBeenCalled();
  });

  it('retries on fallback RPC when primary RPC throws', async () => {
    mockEoaVerifyMessage.mockResolvedValue(false);
    mockPrimaryVerifyMessage.mockRejectedValue(new Error('Alchemy 500'));
    mockFallbackVerifyMessage.mockResolvedValue(true);

    const result = await verifyWalletSignature(ADDRESS, 'hello', SIGNATURE);

    expect(result).toEqual({ ok: true });
    expect(mockFallbackVerifyMessage).toHaveBeenCalledOnce();
  });

  it('returns unavailable when both RPC paths throw', async () => {
    mockEoaVerifyMessage.mockResolvedValue(false);
    mockPrimaryVerifyMessage.mockRejectedValue(new Error('Alchemy 500'));
    mockFallbackVerifyMessage.mockRejectedValue(new Error('Base RPC down'));

    const result = await verifyWalletSignature(ADDRESS, 'hello', SIGNATURE);

    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('returns invalid when verification fails without RPC errors', async () => {
    mockEoaVerifyMessage.mockResolvedValue(false);
    mockPrimaryVerifyMessage.mockResolvedValue(false);

    const result = await verifyWalletSignature(ADDRESS, 'hello', SIGNATURE);

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(mockFallbackVerifyMessage).not.toHaveBeenCalled();
  });

  it('returns invalid for malformed signatures without calling RPC', async () => {
    const result = await verifyWalletSignature(
      ADDRESS,
      'hello',
      'not-a-signature' as `0x${string}`,
    );

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(mockEoaVerifyMessage).not.toHaveBeenCalled();
    expect(mockPrimaryVerifyMessage).not.toHaveBeenCalled();
    expect(mockFallbackVerifyMessage).not.toHaveBeenCalled();
  });
});

describe('requireWalletAuth', () => {
  const timestamp = Math.floor(Date.now() / 1000);

  function authRequest(signature = SIGNATURE) {
    return new Request('http://localhost/api/test', {
      headers: {
        'X-Wallet-Address': ADDRESS,
        'X-Wallet-Timestamp': String(timestamp),
        'X-Wallet-Signature': signature,
      },
    });
  }

  beforeEach(() => {
    mockEoaVerifyMessage.mockReset();
    mockPrimaryVerifyMessage.mockReset();
    mockFallbackVerifyMessage.mockReset();
    mockEoaVerifyMessage.mockResolvedValue(true);
  });

  it('accepts a valid EOA signature from headers', async () => {
    const result = await requireWalletAuth(authRequest());

    expect(result.address).toBe(ADDRESS);
    expect(mockEoaVerifyMessage).toHaveBeenCalledWith({
      address: ADDRESS,
      message: buildWalletAuthMessage(ADDRESS, timestamp),
      signature: SIGNATURE,
    });
  });

  it('throws 503 when RPC verification is unavailable', async () => {
    mockEoaVerifyMessage.mockResolvedValue(false);
    mockPrimaryVerifyMessage.mockRejectedValue(new Error('Alchemy 500'));
    mockFallbackVerifyMessage.mockRejectedValue(new Error('Base RPC down'));

    await expect(requireWalletAuth(authRequest())).rejects.toMatchObject({
      status: 503,
      message: 'Wallet verification temporarily unavailable. Please retry.',
    });
  });

  it('throws 401 for invalid signatures', async () => {
    mockEoaVerifyMessage.mockResolvedValue(false);
    mockPrimaryVerifyMessage.mockResolvedValue(false);

    await expect(requireWalletAuth(authRequest())).rejects.toBeInstanceOf(
      WalletAuthError,
    );
    await expect(requireWalletAuth(authRequest())).rejects.toMatchObject({
      status: 401,
      message: 'Invalid wallet signature',
    });
  });

  it('throws 401 for malformed signatures instead of 503', async () => {
    await expect(requireWalletAuth(authRequest('not-a-signature' as any))).rejects.toMatchObject({
      status: 401,
      message: 'Invalid wallet signature',
    });
    expect(mockPrimaryVerifyMessage).not.toHaveBeenCalled();
    expect(mockFallbackVerifyMessage).not.toHaveBeenCalled();
  });
});

describe('wallet auth header helpers', () => {
  it('reads wallet address case-insensitively', () => {
    expect(
      getWalletAddressFromAuthHeaders({
        'x-wallet-address': ADDRESS,
      }),
    ).toBe(ADDRESS);
    expect(
      getWalletAddressFromAuthHeaders({
        'X-Wallet-Address': ADDRESS,
      }),
    ).toBe(ADDRESS);
  });

  it('maps auth headers to args case-insensitively', () => {
    expect(
      walletAuthHeadersToArgs({
        'X-Wallet-Address': ADDRESS,
        'X-Wallet-Timestamp': '1700000000',
        'X-Wallet-Signature': SIGNATURE,
      }),
    ).toEqual({
      address: ADDRESS,
      timestamp: 1700000000,
      signature: SIGNATURE,
    });
  });
});
