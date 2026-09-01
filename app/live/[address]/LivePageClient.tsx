"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSignerStatus } from "@/lib/wallet/react";
import { isAddress } from "viem";
import { useCreatorWalletAddress } from "@/lib/hooks/accountkit/useCreatorWalletAddress";
import { logger } from "@/lib/utils/logger";

interface LivePageClientProps {
  urlAddress: string;
  children: React.ReactNode;
}

/**
 * Ensures the address in the URL matches the logged-in user's canonical creator address.
 */
export function LivePageClient({ urlAddress, children }: LivePageClientProps) {
  const router = useRouter();
  const { creatorAddress, isLoading } = useCreatorWalletAddress();
  const { isInitializing, isAuthenticating } = useSignerStatus();

  useEffect(() => {
    if (isLoading || isInitializing || isAuthenticating) return;

    if (urlAddress && !isAddress(urlAddress)) {
      logger.warn("Invalid address format in live URL, redirecting...");
      if (creatorAddress) {
        router.replace(`/live/${creatorAddress}`);
      } else {
        router.replace("/live");
      }
      return;
    }

    const normalize = (addr: string | null | undefined) =>
      addr ? addr.toLowerCase() : null;

    const urlAddr = normalize(urlAddress);
    const canonicalAddr = normalize(creatorAddress);

    if (canonicalAddr && urlAddr !== canonicalAddr) {
      logger.debug(
        "Live URL address mismatch, redirecting to canonical address:",
        creatorAddress,
      );
      router.replace(`/live/${creatorAddress}`);
    }
  }, [
    urlAddress,
    creatorAddress,
    isLoading,
    isInitializing,
    isAuthenticating,
    router,
  ]);

  return <>{children}</>;
}
