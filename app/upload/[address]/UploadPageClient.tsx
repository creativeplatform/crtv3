"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useSmartAccountClient, useSignerStatus } from "@account-kit/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { isAddress } from "viem";
import { logger } from '@/lib/utils/logger';


interface UploadPageClientProps {
  urlAddress: string;
  children: React.ReactNode;
}

/**
 * Client component that validates the address in the URL matches the logged-in user's address.
 * If they don't match, redirects to the correct upload page for the logged-in user.
 */
export function UploadPageClient({ urlAddress, children }: UploadPageClientProps) {
  const router = useRouter();
  const { address: scaAddress, isLoadingClient } = useSmartAccountClient({});
  const { account } = useModularAccount();
  const user = useUser();
  const { isInitializing, isAuthenticating } = useSignerStatus();
  const eoaAddress = user?.address;

  // Use the Smart Account address from useModularAccount as primary source
  const smartAccountAddress = account?.address || scaAddress;

  useEffect(() => {
    // Block redirect while account state is transient. Smart account state can
    // briefly drop to undefined during background work (e.g. content-coin deploy
    // right after publish), and a redirect here would cancel an in-flight
    // router.push to /discover.
    if (isLoadingClient || isInitializing || isAuthenticating) return;

    // Validate URL address format
    if (urlAddress && !isAddress(urlAddress)) {
      logger.warn("Invalid address format in URL, redirecting...");
      if (smartAccountAddress) {
        router.replace(`/upload/${smartAccountAddress}`);
      } else if (eoaAddress) {
        router.replace(`/upload/${eoaAddress}`);
      } else {
        router.replace("/upload");
      }
      return;
    }

    const normalizeAddress = (addr: string | undefined) =>
      addr ? addr.toLowerCase() : null;

    const urlAddr = normalizeAddress(urlAddress);
    const smartAddr = normalizeAddress(smartAccountAddress);
    const eoaAddr = normalizeAddress(eoaAddress);

    // If we have a smart account address, use that as the primary address
    if (smartAddr) {
      if (urlAddr !== smartAddr) {
        logger.debug("URL address mismatch, redirecting to Smart Account upload:", smartAccountAddress);
        router.replace(`/upload/${smartAccountAddress}`);
      }
      return;
    }

    // Fallback to EOA address if no smart account
    if (eoaAddr) {
      if (urlAddr !== eoaAddr) {
        logger.debug("URL address mismatch, redirecting to EOA upload:", eoaAddress);
        router.replace(`/upload/${eoaAddress}`);
      }
      return;
    }

    // Truly disconnected (no smart account, no EOA, not loading) — bounce to base upload
    router.replace("/upload");
  }, [urlAddress, smartAccountAddress, eoaAddress, isLoadingClient, isInitializing, isAuthenticating, router]);

  return <>{children}</>;
}

