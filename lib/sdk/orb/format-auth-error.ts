import { formatWalletAuthError } from '@/lib/auth/format-wallet-auth-error';
import {
  isIncompleteOrbSessionError,
  isRevokedOrbSessionError,
} from '@/lib/sdk/orb/session-errors';

function baseMessage(error: unknown, fallback: string): string {
  return (
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback
  ).trim();
}

/** User-facing copy for Orb QR / sign-in failures (init proxy, poll, SDK). */
export function formatOrbAuthError(error: unknown): string {
  const msg = baseMessage(error, 'Orb sign-in failed');
  const lower = msg.toLowerCase();

  if (lower.includes('access denied') || lower.includes('403')) {
    return 'Sign-in was blocked by security checks. Try a private window with extensions off, or try again in a minute.';
  }
  if (
    lower.includes('failed to reach orb') ||
    lower.includes('502') ||
    lower.includes('network') ||
    lower.includes('fetch failed')
  ) {
    return 'Orb sign-in is temporarily unavailable. Please try again in a moment.';
  }
  if (lower.includes('qr poll') || lower.includes('poll requests')) {
    return 'Sign-in check is busy — still waiting on your phone. Please wait a moment.';
  }
  if (lower.includes('too many') || lower.includes('rate limit')) {
    return 'Too many sign-in attempts. Please wait a minute and try again.';
  }
  if (lower.includes('invalid orb access token') || lower.includes('401')) {
    return 'Your Orb session expired. Sign in again with the Orb app.';
  }
  if (isRevokedOrbSessionError(error)) {
    return 'Your Orb session was signed out. Sign in again with Orb to interact on Lens.';
  }
  if (isIncompleteOrbSessionError(error)) {
    return 'Sign in again with Orb to post and interact on Lens.';
  }
  if (
    lower.includes('wallet not connected') ||
    lower.includes('sign in with your wallet') ||
    lower.includes('user rejected') ||
    lower.includes('denied')
  ) {
    return formatWalletAuthError(error).replace(
      'verify access',
      'link your profile',
    );
  }
  if (
    lower.includes('lens_account_id') &&
    (lower.includes('schema cache') || lower.includes('could not find'))
  ) {
    return 'Database is missing Orb/Lens profile columns. Run scripts/add-orb-lens-columns-to-creator-profiles.sql in the Supabase SQL Editor, then try again.';
  }
  if (
    lower.includes('creator_profiles_orb_account_id_key') ||
    lower.includes('already linked to another profile')
  ) {
    return 'This Orb account is already linked to a different wallet profile. Connect the wallet you used before, or contact support to transfer the link.';
  }

  return msg.length > 160 ? `${msg.slice(0, 157)}…` : msg;
}

/** User-facing copy for wallet ↔ Lens profile link failures (link-orb API). */
export function formatOrbLinkError(error: unknown): string {
  const msg = baseMessage(error, 'Failed to link Orb profile');
  const lower = msg.toLowerCase();

  if (lower.includes('too many') || lower.includes('rate limit')) {
    return "Profile link is busy — we'll retry shortly.";
  }
  if (
    lower.includes('wallet not connected') ||
    lower.includes('sign in with your wallet') ||
    lower.includes('user rejected') ||
    lower.includes('denied')
  ) {
    return formatWalletAuthError(error).replace(
      'verify access',
      'link your profile',
    );
  }
  if (lower.includes('invalid wallet signature')) {
    return 'Wallet signature could not be verified. Approve the signature prompt again, or wait a moment and tap Sync profile.';
  }
  if (
    lower.includes('wallet verification temporarily unavailable') ||
    lower.includes('verification temporarily unavailable')
  ) {
    return "Profile link is temporarily unavailable. Wait a moment and tap Sync profile again.";
  }
  if (
    lower.includes('lens_account_id') &&
    (lower.includes('schema cache') || lower.includes('could not find'))
  ) {
    return 'Database is missing Orb/Lens profile columns. Run scripts/add-orb-lens-columns-to-creator-profiles.sql in the Supabase SQL Editor, then try again.';
  }

  return msg.length > 160 ? `${msg.slice(0, 157)}…` : msg;
}

export function isOrbLinkRateLimitError(error: unknown): boolean {
  const lower = baseMessage(error, '').toLowerCase();
  return lower.includes('too many') || lower.includes('rate limit');
}
