import { describe, expect, it } from 'vitest';
import { formatOrbAuthError, formatOrbLinkError } from './format-auth-error';

describe('formatOrbAuthError', () => {
  it('maps incomplete Orb session to re-sign copy', () => {
    expect(
      formatOrbAuthError(new Error('Orb session is missing a refresh token')),
    ).toMatch(/sign in again with orb/i);
  });
  it('maps access denied to security-checks copy', () => {
    expect(formatOrbAuthError(new Error('Access denied'))).toMatch(/security checks/i);
    expect(formatOrbAuthError(new Error('Access denied'))).not.toMatch(/VPN/i);
  });

  it('maps upstream failures', () => {
    expect(formatOrbAuthError('Failed to reach Orb sign-in service')).toMatch(
      /temporarily unavailable/i,
    );
  });

  it('maps wallet link prerequisites', () => {
    expect(formatOrbAuthError('Sign in with your wallet to link your profile.')).toMatch(
      /Get Started/i,
    );
  });

  it('maps revoked Orb/Lens session copy', () => {
    expect(
      formatOrbAuthError(
        new Error('You are trying to renew a revoked authentication'),
      ),
    ).toMatch(/signed out/i);
  });

  it('maps missing lens_account_id schema cache errors', () => {
    expect(
      formatOrbAuthError(
        "Could not find the 'lens_account_id' column of 'creator_profiles' in the schema cache",
      ),
    ).toMatch(/add-orb-lens-columns/i);
  });

  it('maps duplicate orb_account_id constraint errors', () => {
    expect(
      formatOrbAuthError(
        'duplicate key value violates unique constraint "creator_profiles_orb_account_id_key"',
      ),
    ).toMatch(/different wallet profile/i);
  });
});

describe('formatOrbLinkError', () => {
  it('maps invalid wallet signature to actionable copy', () => {
    expect(formatOrbLinkError(new Error('Invalid wallet signature'))).toMatch(
      /Approve the signature prompt again/i,
    );
  });

  it('maps verification unavailable to retry copy', () => {
    expect(
      formatOrbLinkError(
        new Error('Wallet verification temporarily unavailable. Please retry.'),
      ),
    ).toMatch(/temporarily unavailable/i);
  });
});
