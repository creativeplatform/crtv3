'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useCreatorWalletAddress } from '@/lib/hooks/accountkit/useCreatorWalletAddress';
import { getWalletAddressFromAuthHeaders } from '@/lib/auth/require-wallet';
import {
  getOrbLogin,
  loadStoredOrbSession,
  saveStoredOrbSession,
  clearStoredOrbSession,
  subscribeOrbSession,
  getOrbSessionServerSnapshot,
  hasOrbWriteCredentials,
  normalizeOrbAuthTokens,
  type StoredOrbSession,
} from '@/lib/sdk/orb/login';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import {
  formatOrbAuthError,
  formatOrbLinkError,
  isOrbLinkRateLimitError,
} from '@/lib/sdk/orb/format-auth-error';
import { isStaleOrbSessionError } from '@/lib/sdk/orb/session-errors';
import { toast } from 'sonner';

export type OrbLinkStatus = 'idle' | 'linked' | 'needs_wallet' | 'failed';

type OrbSessionContextValue = {
  session: StoredOrbSession | null;
  lensAccount: string | null;
  isAuthenticated: boolean;
  isLinking: boolean;
  isLoginModalOpen: boolean;
  loginError: string | null;
  linkStatus: OrbLinkStatus;
  hasWallet: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  clearLoginError: () => void;
  connectWithQr: (onInit?: (payload: { qrCode: string; deepLink?: string }) => void) => Promise<void>;
  logout: () => Promise<void>;
  syncSession: () => Promise<StoredOrbSession | null>;
  linkProfile: (ownerAddress?: string) => Promise<void>;
  /** Bumped after Orb sign-in so account menus can reopen with fresh state. */
  accountMenuRefreshSignal: number;
};

const OrbSessionContext = createContext<OrbSessionContextValue | null>(null);

export function OrbSessionProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(
    subscribeOrbSession,
    loadStoredOrbSession,
    getOrbSessionServerSnapshot,
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<OrbLinkStatus>('idle');
  const [accountMenuRefreshSignal, setAccountMenuRefreshSignal] = useState(0);
  const { creatorAddress: walletAddress, isLoading: isWalletIdentityLoading } =
    useCreatorWalletAddress();
  const {
    getAuthHeaders,
    clearAuthCache,
    address: authAddress,
    isReady: isWalletAuthReady,
  } = useWalletAuth();
  const orb = useMemo(() => getOrbLogin(), []);
  const linkProfileInFlightRef = useRef<Promise<void> | null>(null);

  const hasWallet = !!walletAddress;

  const lensAccount = useMemo(() => {
    if (!session?.accessToken) return null;
    return orb.getAccountFromAccessToken(session.accessToken);
  }, [session, orb]);

  const persistSession = useCallback((next: StoredOrbSession | null) => {
    saveStoredOrbSession(next);
  }, []);

  const invalidateOrbSession = useCallback(
    (options?: { notify?: boolean }) => {
      clearStoredOrbSession();
      setLoginError(null);
      setLinkStatus('idle');
      if (options?.notify !== false) {
        toast.info(
          'Your Orb session ended. Sign in again to like posts and join groups.',
        );
      }
    },
    [],
  );

  const bumpAccountMenuRefresh = useCallback(() => {
    setAccountMenuRefreshSignal((n) => n + 1);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("crtv:close-mobile-menu"));
    }
  }, []);

  const syncSession = useCallback(async () => {
    if (!session?.accessToken) return null;
    let syncTimeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const synced = await Promise.race([
        orb.syncSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          authenticationId: session.authenticationId,
        }),
        new Promise<never>((_, reject) => {
          syncTimeoutId = setTimeout(
            () => reject(new Error('Orb session sync timed out')),
            20_000,
          );
        }),
      ]);
      if (!synced?.accessToken) {
        invalidateOrbSession();
        return null;
      }
      const merged = normalizeOrbAuthTokens({
        accessToken: synced.accessToken,
        refreshToken: synced.refreshToken ?? session.refreshToken,
        authenticationId: synced.authenticationId ?? session.authenticationId,
        idToken: synced.idToken ?? session.idToken,
      });
      if (!merged || !hasOrbWriteCredentials(merged)) {
        invalidateOrbSession();
        return null;
      }
      persistSession(merged);
      return merged;
    } catch (err) {
      if (isStaleOrbSessionError(err)) {
        invalidateOrbSession();
        return null;
      }
      if (!hasOrbWriteCredentials(session)) {
        invalidateOrbSession();
        return null;
      }
      return session;
    } finally {
      if (syncTimeoutId !== undefined) {
        clearTimeout(syncTimeoutId);
      }
    }
  }, [session, orb, persistSession, invalidateOrbSession]);

  /** Reset link UI when tokens were cleared outside this provider (e.g. Songchain feed). */
  useEffect(() => {
    if (!session?.accessToken && linkStatus === 'linked') {
      setLinkStatus('idle');
    }
  }, [session?.accessToken, linkStatus]);

  /** Clear revoked/expired Orb tokens so Songchain and feeds stay read-only instead of erroring. */
  useEffect(() => {
    const token = session?.accessToken;
    if (!token) return;

    let cancelled = false;
    void (async () => {
      try {
        await syncSession();
      } catch {
        /* syncSession handles stale sessions internally */
      }
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, syncSession]);

  const linkProfile = useCallback(
    async (ownerAddress?: string) => {
      if (linkProfileInFlightRef.current) {
        return linkProfileInFlightRef.current;
      }

      const run = async () => {
        const active = session ?? loadStoredOrbSession();
        if (!active?.accessToken) return;

        const wallet = (
          ownerAddress ||
          authAddress ||
          walletAddress ||
          undefined
        )?.toLowerCase();

        const hasOrbSession = !!active.accessToken;

        if (!wallet) {
          setLinkStatus('needs_wallet');
          const message = formatOrbLinkError(
            'Connect your wallet with Get Started before linking your Lens identity.',
          );
          setLoginError(message);
          if (!hasOrbSession) toast.error(message);
          else toast.info(message);
          return;
        }

        setIsLinking(true);
        try {
          if (isWalletIdentityLoading || !isWalletAuthReady) {
            setLinkStatus('needs_wallet');
            const message =
              'Wallet is still initializing. Wait a moment, then tap Sync profile again.';
            setLoginError(message);
            toast.info(message);
            return;
          }

          let authHeaders: Record<string, string>;
          try {
            authHeaders = await getAuthHeaders();
          } catch (signErr) {
            setLinkStatus('failed');
            const message = formatOrbLinkError(signErr);
            setLoginError(message);
            if (hasOrbSession) toast.warning(message);
            else toast.error(message);
            return;
          }

          const ownerAddressFromAuth = (headers: Record<string, string>) =>
            getWalletAddressFromAuthHeaders(headers) || wallet;

          const retryDelays = [0, 5_000, 15_000, 30_000];
          let lastErr: unknown = null;
          let authRetried = false;

          for (let attempt = 0; attempt < retryDelays.length; attempt++) {
            if (retryDelays[attempt] > 0) {
              await new Promise((r) => setTimeout(r, retryDelays[attempt]));
            }

            try {
              const res = await fetch('/api/creator-profiles/link-orb', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...authHeaders,
                },
                body: JSON.stringify({
                  accessToken: active.accessToken,
                  authenticationId: active.authenticationId,
                  owner_address: ownerAddressFromAuth(authHeaders),
                }),
              });

              let data: { success?: boolean; error?: string } = {};
              try {
                data = await res.json();
              } catch {
                // Non-JSON body (e.g. HTML error page on 502/429)
              }

              if (res.ok && data.success) {
                setLinkStatus('linked');
                setLoginError(null);
                toast.success('Orb / Lens identity linked to your profile');
                return;
              }

              const errorText = data.error || `Failed to link Orb profile (${res.status})`;
              const isInvalidSignature =
                res.status === 401 &&
                errorText.toLowerCase().includes('invalid wallet signature');

              if (isInvalidSignature && !authRetried) {
                authRetried = true;
                clearAuthCache();
                try {
                  authHeaders = await getAuthHeaders();
                  attempt -= 1;
                  continue;
                } catch (signErr) {
                  lastErr = signErr;
                  break;
                }
              }

              lastErr = new Error(errorText);
              if (res.status !== 429 && !isOrbLinkRateLimitError(lastErr)) {
                break;
              }
            } catch (err) {
              lastErr = err;
            }
          }

          throw lastErr ?? new Error('Failed to link Orb profile');
        } catch (err) {
          setLinkStatus('failed');
          const message = formatOrbLinkError(err);
          setLoginError(message);
          if (hasOrbSession) {
            toast.warning(message);
          } else {
            toast.error(message);
          }
        } finally {
          setIsLinking(false);
        }
      };

      const promise = run().finally(() => {
        linkProfileInFlightRef.current = null;
      });
      linkProfileInFlightRef.current = promise;
      return promise;
    },
    [
      session,
      authAddress,
      walletAddress,
      getAuthHeaders,
      clearAuthCache,
      isWalletAuthReady,
      isWalletIdentityLoading,
    ],
  );

  useEffect(() => {
    if (!session?.accessToken || !walletAddress) return;
    if (linkStatus !== 'needs_wallet') return;
    void linkProfile(walletAddress);
  }, [session?.accessToken, walletAddress, linkStatus, linkProfile]);

  /** Restore link status after refresh when profile was already linked server-side. */
  useEffect(() => {
    if (!session?.accessToken || !walletAddress || !lensAccount) return;
    if (linkStatus === 'linked' || linkStatus === 'needs_wallet') return;

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/creator-profiles?owner=${encodeURIComponent(walletAddress)}`,
          { signal: controller.signal },
        );
        const json = await res.json();
        if (!json?.success || !json.data?.lens_account_id) return;
        const storedLens = String(json.data.lens_account_id).toLowerCase();
        if (storedLens === lensAccount.toLowerCase()) {
          setLinkStatus('linked');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Non-fatal: user can still use Sync profile / Link Orb
      }
    })();

    return () => {
      controller.abort();
    };
  }, [session?.accessToken, walletAddress, lensAccount, linkStatus]);

  const connectWithQr = useCallback(
    async (onInit?: (payload: { qrCode: string; deepLink?: string }) => void) => {
      setLoginError(null);
      try {
        const result = await orb.connectWithQr({
          onInit: (payload) => {
            onInit?.({ qrCode: payload.qrCode, deepLink: payload.deepLink });
          },
        });

        const stored = normalizeOrbAuthTokens(
          result as unknown as Record<string, unknown>,
        );

        if (!stored?.refreshToken?.trim()) {
          throw new Error(
            'Orb sign-in did not return a refresh token. Try signing in again.',
          );
        }
        persistSession(stored);
        setIsLoginModalOpen(false);
        bumpAccountMenuRefresh();
        toast.success('Signed in with Orb');

        if (walletAddress) {
          void linkProfile(walletAddress).catch(() => undefined);
        } else {
          setLinkStatus('needs_wallet');
          toast.info(
            'Orb connected. Use Get Started to connect your wallet, then sync your profile.',
          );
        }
      } catch (err) {
        const message = formatOrbAuthError(err);
        setLoginError(message);
        throw new Error(message);
      }
    },
    [orb, persistSession, bumpAccountMenuRefresh, walletAddress, linkProfile],
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
    clearStoredOrbSession();
    setLoginError(null);
    setLinkStatus('idle');
    toast.success('Signed out of Orb');
  }, [session, orb]);

  const openLoginModal = useCallback(() => {
    if (!hasWallet) {
      const message = formatOrbAuthError(
        'Connect your wallet with Get Started before linking your Lens identity.',
      );
      toast.info(message);
      return;
    }
    setLoginError(null);
    setIsLoginModalOpen(true);
  }, [hasWallet]);

  const value = useMemo<OrbSessionContextValue>(
    () => ({
      session,
      lensAccount,
      isAuthenticated: !!session?.accessToken,
      isLinking,
      isLoginModalOpen,
      loginError,
      linkStatus,
      hasWallet,
      openLoginModal,
      closeLoginModal: () => setIsLoginModalOpen(false),
      clearLoginError: () => setLoginError(null),
      connectWithQr,
      logout,
      syncSession,
      linkProfile,
      accountMenuRefreshSignal,
    }),
    [
      session,
      lensAccount,
      isLinking,
      isLoginModalOpen,
      loginError,
      linkStatus,
      hasWallet,
      openLoginModal,
      connectWithQr,
      logout,
      syncSession,
      linkProfile,
      accountMenuRefreshSignal,
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
