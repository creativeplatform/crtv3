'use client';

import { useCallback } from 'react';
import { useLogout } from '@/lib/wallet/react';
import { useOrbSession } from '@/context/OrbSessionContext';

/** Signs out of both Account Kit wallet and Orb / Lens session. */
export function useUnifiedLogout() {
  const { logout: walletLogout } = useLogout();
  const { logout: orbLogout } = useOrbSession();

  return useCallback(async () => {
    await orbLogout();
    await walletLogout();
  }, [orbLogout, walletLogout]);
}
