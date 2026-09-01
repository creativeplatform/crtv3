import { describe, expect, it } from 'vitest';
import {
  formatWalletAuthError,
  isWalletSigningRejected,
} from './format-wallet-auth-error';

describe('formatWalletAuthError', () => {
  it('detects user rejection', () => {
    const err = new Error('User rejected the request');
    expect(isWalletSigningRejected(err)).toBe(true);
    expect(formatWalletAuthError(err)).toContain('cancelled');
  });

  it('maps missing wallet to connect copy', () => {
    expect(formatWalletAuthError(new Error('Wallet not connected'))).toContain(
      'Connect your wallet',
    );
  });
});
