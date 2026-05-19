'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useUser } from '@account-kit/react';
import useModularAccount from '@/lib/hooks/accountkit/useModularAccount';
import {
  getOrbLogin,
  loadStoredOrbSession,
  saveStoredOrbSession,
  type StoredOrbSession,
} from '@/lib/sdk/orb/login';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { toast } from 'sonner';

type OrbSessionContextValue = {
  session: StoredOrbSession | null;
  lensAccount: string | null;
  isAuthenticated: boolean;
  isLinking: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  connectWithQr: (onInit?: (payload: { qrCode: string; deepLink?: string }) => void) => Promise<void>;
  logout: () => Promise<void>;
  syncSession: () => Promise<StoredOrbSession | null>;
  linkProfile: (ownerAddress?: string) => Promise<void>;
};

const OrbSessionContext = createContext<OrbSessionContextValue | null>(null);

export function OrbSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredOrbSession | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const user = useUser();
  const { account: modularAccount } = useModularAccount();
  const { getAuthHeaders } = useWalletAuth();
  const orb = useMemo(() => getOrbLogin(), []);

  const lensAccount = useMemo(() => {
    if (!session?.accessToken) return null;
    return orb.getAccountFromAccessToken(session.accessToken);
  }, [session, orb]);

  useEffect(() => {
    setSession(loadStoredOrbSession());
  }, []);

  const persistSession = useCallback((next: StoredOrbSession | null) => {
    saveStoredOrbSession(next);
    setSession(next);
  }, []);

  const syncSession = useCallback(async () => {
    if (!session?.accessToken) return null;
    try {
      const synced = await orb.syncSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        authenticationId: session.authenticationId,
      });
      if (!synced?.accessToken) return null;
      const stored: StoredOrbSession = {
        accessToken: synced.accessToken,
        refreshToken: synced.refreshToken ?? session.refreshToken,
        authenticationId: synced.authenticationId ?? session.authenticationId,
        idToken: synced.idToken ?? session.idToken,
      };
      persistSession(stored);
      return stored;
    } catch {
      return session;
    }
  }, [session, orb, persistSession]);

  const linkProfile = useCallback(
    async (ownerAddress?: string) => {
      const active = session ?? loadStoredOrbSession();
      if (!active?.accessToken) return;

      const wallet = (
        ownerAddress ||
        modularAccount?.address ||
        user?.address ||
        undefined
      )?.toLowerCase();

      if (!wallet) {
        toast.error('Connect a wallet to link your Orb / Lens profile.');
        return;
      }

      setIsLinking(true);
      try {
        let authHeaders: Record<string, string>;
        try {
          authHeaders = await getAuthHeaders();
        } catch {
          toast.error('Sign in with your wallet to link your profile.');
          return;
        }

        const res = await fetch('/api/creator-profiles/link-orb', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            accessToken: active.accessToken,
            authenticationId: active.authenticationId,
            owner_address: wallet,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to link Orb profile');
        }
        toast.success('Orb / Lens identity linked to your profile');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Profile link failed');
      } finally {
        setIsLinking(false);
      }
    },
    [session, modularAccount?.address, user?.address, getAuthHeaders],
  );

  const connectWithQr = useCallback(
    async (onInit?: (payload: { qrCode: string; deepLink?: string }) => void) => {
      const result = await orb.connectWithQr({
        onInit: (payload) => {
          onInit?.({ qrCode: payload.qrCode, deepLink: payload.deepLink });
        },
      });

      const stored: StoredOrbSession = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        authenticationId: result.authenticationId,
        idToken: result.idToken,
      };
      persistSession(stored);
      setIsLoginModalOpen(false);
      toast.success('Signed in with Orb');

      const wallet = modularAccount?.address || user?.address;
      if (wallet) {
        await linkProfile(wallet);
      }
    },
    [orb, persistSession, modularAccount?.address, user?.address, linkProfile],
  );

  const logout = useCallback(async () => {
    if (session?.authenticationId && session.accessToken) {
      try {
        await orb.revoke({
          authenticationId: session.authenticationId,
          accessToken: session.accessToken,
        });
      } catch {
        // still clear local session
      }
    }
    persistSession(null);
    toast.success('Signed out of Orb');
  }, [session, orb, persistSession]);

  const value = useMemo<OrbSessionContextValue>(
    () => ({
      session,
      lensAccount,
      isAuthenticated: !!session?.accessToken,
      isLinking,
      isLoginModalOpen,
      openLoginModal: () => setIsLoginModalOpen(true),
      closeLoginModal: () => setIsLoginModalOpen(false),
      connectWithQr,
      logout,
      syncSession,
      linkProfile,
    }),
    [
      session,
      lensAccount,
      isLinking,
      isLoginModalOpen,
      connectWithQr,
      logout,
      syncSession,
      linkProfile,
    ],
  );

  return (
    <OrbSessionContext.Provider value={value}>{children}</OrbSessionContext.Provider>
  );
}

export function useOrbSession(): OrbSessionContextValue {
  const ctx = useContext(OrbSessionContext);
  if (!ctx) {
    throw new Error('useOrbSession must be used within OrbSessionProvider');
  }
  return ctx;
}
