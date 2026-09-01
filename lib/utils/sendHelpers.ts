import { getAddress, isAddress, type Address } from 'viem';
import { parseBundlerError } from '@/lib/utils/bundlerErrorParser';

export function normalizeRecipientAddress(input: string): Address | null {
  const trimmed = input.trim();
  if (!isAddress(trimmed)) return null;
  return getAddress(trimmed);
}

export function formatSendError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Failed to initiate transaction.';
  }
  const parsed = parseBundlerError(error);
  return `${parsed.message}. ${parsed.suggestion}`;
}

export const ETH_SEND_GAS_BUFFER = 0.001;

export function getMaxEthSendAmount(balance: string, buffer = ETH_SEND_GAS_BUFFER): string {
  const max = getMaxSendableAmount('ETH', balance, buffer);
  return max.toFixed(6);
}

/** Max sendable amount; ETH reserves a gas buffer, other tokens use full balance. */
export function getMaxSendableAmount(
  token: string,
  balance: string,
  buffer = ETH_SEND_GAS_BUFFER,
): number {
  const available = parseFloat(balance);
  if (Number.isNaN(available) || available <= 0) return 0;
  if (token === 'ETH') {
    const max = available - buffer;
    return max > 0 ? max : 0;
  }
  return available;
}

/** Returns an error message when amount exceeds sendable balance, otherwise null. */
export function validateSendBalance(
  token: string,
  amount: string,
  balance: string,
): string | null {
  const requested = parseFloat(amount);
  if (Number.isNaN(requested) || requested <= 0) {
    return 'Please enter a valid amount';
  }

  const maxSendable = getMaxSendableAmount(token, balance);
  if (requested <= maxSendable) return null;

  if (token === 'ETH' && maxSendable < parseFloat(balance)) {
    return `Leave at least ${ETH_SEND_GAS_BUFFER} ETH for gas (max send: ${maxSendable.toFixed(6)} ETH).`;
  }

  return `Insufficient balance. You have ${balance} ${token}, but trying to send ${amount} ${token}`;
}
