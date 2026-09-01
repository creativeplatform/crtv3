"use client";

import { useEffect, useRef } from 'react';
import { useUser } from '@/lib/wallet/react';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';


/**
 * Monitor auth state transitions and handle cleanup
 * Helps debug and recover from stuck auth states
 */
export function useAuthStateMonitor() {
  const user = useUser();
  const previousUserRef = useRef(user);
  const logoutToastShownRef = useRef(false);

  useEffect(() => {
    const previousUser = previousUserRef.current;

    // User transitioned from logged in to logged out
    if (previousUser && !user) {
      logger.debug('🔴 User logged out/timed out');

      // Show toast only once
      if (!logoutToastShownRef.current) {
        toast.info('Session ended. Click "Get Started" to reconnect.');
        logoutToastShownRef.current = true;
      }

      // Removed aggressive localStorage cleanup to prevent "stuck" state
      // where user has to refresh to sign in again.
    }

    // User logged in
    if (!previousUser && user) {
      logger.debug('🟢 User logged in:', user.address);
      logoutToastShownRef.current = false;
    }

    previousUserRef.current = user;
  }, [user]);

  return { currentUser: user, previousUser: previousUserRef.current };
}
