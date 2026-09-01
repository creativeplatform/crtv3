// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { CompatSmartAccountClient } from '@/lib/wallet/smart-wallet-client';
import type { LocalAccount } from 'viem/accounts';

const mockSigner: {
  signMessage: Mock<(...args: any[]) => any>;
  signTypedData: Mock<(...args: any[]) => any>;
  address: string;
} = {
  signMessage: vi.fn(),
  signTypedData: vi.fn(),
  address: '0x1111111111111111111111111111111111111111',
};

const mockWalletClientContext = {
  signer: mockSigner as unknown as LocalAccount,
  eoaAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
  client: undefined,
  address: '0x2222222222222222222222222222222222222222' as `0x${string}`,
  isLoadingClient: false,
  error: null,
  refreshClient: vi.fn(),
};

vi.mock('@/lib/wallet/wallet-context', () => ({
  useWalletClientContext: () => mockWalletClientContext,
}));

vi.mock('@/lib/wallet/chain-context', () => ({
  useWalletChain: () => ({ chain: undefined }),
}));

vi.mock('@/lib/wallet/auth-error-context', () => ({
  useAuthErrorContext: () => ({ login: vi.fn() }),
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ user: null, authenticated: false, ready: true }),
  useLogout: () => ({ logout: vi.fn() }),
  useWallets: () => ({ wallets: [] }),
  toViemAccount: vi.fn(),
}));

import { useSignMessage, useSignTypedData } from './react';

async function renderHook<T>(
  useHook: () => T,
): Promise<{ result: { current: T }; unmount: () => void }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const resultRef = { current: null as unknown as T };

  function HookWrapper() {
    resultRef.current = useHook();
    return null;
  }

  await act(async () => {
    root.render(<HookWrapper />);
  });

  return {
    result: resultRef as { current: T },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('useSignMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers the smart-account client over the raw signer when client is provided', async () => {
    const smartClient = {
      signMessage: vi.fn().mockResolvedValue('0xsmart'),
    } as unknown as CompatSmartAccountClient;

    const { result, unmount } = await renderHook(() =>
      useSignMessage({ client: smartClient }),
    );

    const signature = await result.current.signMessage({ message: 'hello' });
    expect(signature).toBe('0xsmart');
    expect(smartClient.signMessage).toHaveBeenCalledWith({
      message: 'hello',
    });
    expect(mockSigner.signMessage).not.toHaveBeenCalled();

    unmount();
  });

  it('falls back to the raw signer when no client is provided', async () => {
    mockSigner.signMessage.mockResolvedValue('0xeoa');

    const { result, unmount } = await renderHook(() => useSignMessage({}));

    const signature = await result.current.signMessage({ message: 'hello' });
    expect(signature).toBe('0xeoa');
    expect(mockSigner.signMessage).toHaveBeenCalledWith({
      message: 'hello',
    });

    unmount();
  });

  it('prefers the smart-account client for typed-data when client is provided', async () => {
    const typedData = {
      domain: { name: 'test' },
      types: { Message: [{ name: 'content', type: 'string' }] },
      primaryType: 'Message',
      message: { content: 'hello' },
    };

    const smartClient = {
      signTypedData: vi.fn().mockResolvedValue('0xsmarttyped'),
    } as unknown as CompatSmartAccountClient;

    const { result, unmount } = await renderHook(() =>
      useSignTypedData({ client: smartClient }),
    );

    const signature = await result.current.signTypedData({ typedData });
    expect(signature).toBe('0xsmarttyped');
    expect(smartClient.signTypedData).toHaveBeenCalled();
    expect(mockSigner.signMessage).not.toHaveBeenCalled();

    unmount();
  });

  it('falls back to the raw signer for typed-data when no client is provided', async () => {
    const typedData = {
      domain: { name: 'test' },
      types: { Message: [{ name: 'content', type: 'string' }] },
      primaryType: 'Message',
      message: { content: 'hello' },
    };

    mockSigner.signTypedData = vi.fn().mockResolvedValue('0xeoatyped');

    const { result, unmount } = await renderHook(() => useSignTypedData({}));

    const signature = await result.current.signTypedData({ typedData });
    expect(signature).toBe('0xeoatyped');
    expect(mockSigner.signTypedData).toHaveBeenCalled();

    unmount();
  });
});
