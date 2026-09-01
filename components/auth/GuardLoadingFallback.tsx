'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/wallet/react';
import { clearStoredOrbSession } from '@/lib/sdk/orb/login';
import { resetAppSession } from '@/lib/auth/session-recovery';

const GUARD_TIMEOUT_MS = 8000;

type GuardLoadingFallbackProps = {
  isLoading: boolean;
  /** When true, show children after timeout instead of blocking forever. */
  allowBypass?: boolean;
  message?: string;
  children: React.ReactNode;
};

export function GuardLoadingFallback({
  isLoading,
  allowBypass = false,
  message = 'Loading your session…',
  children,
}: GuardLoadingFallbackProps) {
  const [timedOut, setTimedOut] = useState(false);
  const { logout: walletLogoutMutate } = useLogout();

  const walletLogout = useCallback(async () => {
    await walletLogoutMutate();
  }, [walletLogoutMutate]);

  const orbLogout = useCallback(async () => {
    clearStoredOrbSession();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), GUARD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (!isLoading) {
    return <>{children}</>;
  }

  if (allowBypass && timedOut) {
    return (
      <>
        {children}
        <div
          className="fixed inset-x-0 bottom-0 z-[100] border-t border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur-sm"
          role="status"
        >
          <p className="text-sm text-muted-foreground mb-3">{message}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                void resetAppSession({ walletLogout, orbLogout })
              }
            >
              Reset session
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Reset session clears wallet and Orb sign-in without wiping all browser data.
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
        {timedOut && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void resetAppSession({ walletLogout, orbLogout })
            }
          >
            Reset session
          </Button>
        )}
      </div>
    </div>
  );
}
