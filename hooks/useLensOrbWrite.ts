'use client';

import { useCallback, useMemo } from 'react';
import { useAuthModal } from '@/lib/wallet/react';
import { useOrbSession } from '@/context/OrbSessionContext';
import { resumeLensSessionFromOrb } from '@/lib/sdk/lens/orb-session-client';
import {
  hasOrbWriteCredentials,
  ORB_INCOMPLETE_SESSION_MESSAGE,
} from '@/lib/sdk/orb/login';
import type { SessionClient } from '@lens-protocol/client';

export type LensOrbWriteAccess = {
  /** Linked Orb + wallet profile — required for likes, join group, etc. */
  canWrite: boolean;
  /** Orb signed in but profile not linked yet */
  needsLink: boolean;
  /** No Orb session */
  needsOrbLogin: boolean;
  /** Linked but missing refresh token — must re-sign with Orb */
  needsOrbReauth: boolean;
  lensAccount: string | null;
  getSessionClient: () => Promise<SessionClient>;
  promptWriteAccess: () => void;
};

export function useLensOrbWrite(): LensOrbWriteAccess {
  const {
    session,
    syncSession,
    isAuthenticated,
    linkStatus,
    lensAccount,
    hasWallet,
    openLoginModal,
  } = useOrbSession();
  const { openAuthModal } = useAuthModal();

  const hasWriteCredentials = hasOrbWriteCredentials(session);
  const needsOrbReauth =
    isAuthenticated && linkStatus === 'linked' && !hasWriteCredentials;
  const canWrite =
    isAuthenticated && linkStatus === 'linked' && hasWriteCredentials;
  const needsLink = isAuthenticated && linkStatus !== 'linked';
  const needsOrbLogin = !isAuthenticated;

  const getSessionClient = useCallback(async () => {
    if (!isAuthenticated || linkStatus !== 'linked') {
      throw new Error('Link your Orb account to interact on Lens');
    }
    if (!session?.accessToken) {
      throw new Error('Orb session expired — sign in again');
    }
    const synced = (await syncSession()) ?? session;
    if (!hasOrbWriteCredentials(synced)) {
      throw new Error(ORB_INCOMPLETE_SESSION_MESSAGE);
    }
    return resumeLensSessionFromOrb(synced);
  }, [isAuthenticated, linkStatus, session, syncSession]);

  const promptWriteAccess = useCallback(() => {
    if (!hasWallet) {
      openAuthModal();
      return;
    }
    if (needsOrbLogin || needsLink || needsOrbReauth) {
      openLoginModal();
    }
  }, [
    needsOrbLogin,
    needsLink,
    needsOrbReauth,
    hasWallet,
    openLoginModal,
    openAuthModal,
  ]);

  return useMemo(
    () => ({
      canWrite,
      needsLink,
      needsOrbLogin,
      needsOrbReauth,
      lensAccount,
      getSessionClient,
      promptWriteAccess,
    }),
    [
      canWrite,
      needsLink,
      needsOrbLogin,
      needsOrbReauth,
      lensAccount,
      getSessionClient,
      promptWriteAccess,
    ],
  );
}
