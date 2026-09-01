function baseMessage(error: unknown, fallback: string): string {
  return (
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback
  ).trim();
}

/** True when the user dismissed the wallet signature prompt. */
export function isWalletSigningRejected(error: unknown): boolean {
  const lower = baseMessage(error, '').toLowerCase();
  return (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request') ||
    lower.includes('denied transaction') ||
    lower.includes('denied message') ||
    lower.includes('request rejected')
  );
}

/** User-facing copy for wallet signature / auth header failures. */
export function formatWalletAuthError(error: unknown): string {
  const msg = baseMessage(error, 'Wallet authorization failed');
  const lower = msg.toLowerCase();

  if (lower.includes('wallet not connected')) {
    return 'Connect your wallet with Get Started to continue.';
  }
  if (lower.includes('sign in with your wallet')) {
    return 'Connect your wallet with Get Started to continue.';
  }
  if (isWalletSigningRejected(error)) {
    return 'Wallet signature was cancelled. Approve the signature to verify access.';
  }
  if (lower.includes('auth signature is too old')) {
    return 'Your wallet authorization expired. Approve a new signature to continue.';
  }
  if (lower.includes('invalid wallet signature')) {
    return 'Wallet signature was invalid. Approve the signature again to continue.';
  }
  if (lower.includes('missing wallet auth')) {
    return 'Connect your wallet with Get Started to continue.';
  }

  return msg.length > 160 ? `${msg.slice(0, 157)}…` : msg;
}
