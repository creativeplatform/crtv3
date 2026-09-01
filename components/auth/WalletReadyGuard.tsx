"use client";

import { usePrivy } from "@privy-io/react-auth";
import { GuardLoadingFallback } from "@/components/auth/GuardLoadingFallback";

/**
 * Waits for Privy auth SDK initialization before rendering wallet-dependent guards.
 */
export function WalletReadyGuard({ children }: { children: React.ReactNode }) {
  const { ready } = usePrivy();

  if (!ready) {
    return (
      <GuardLoadingFallback isLoading allowBypass={false}>
        {children}
      </GuardLoadingFallback>
    );
  }

  return <>{children}</>;
}
