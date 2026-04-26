"use client";

/**
 * Client hook that produces the wallet-auth headers our server-side
 * `requireWalletAuth` helper expects. One signature is reused for the full
 * 5-minute window so the user isn't prompted on every API call.
 *
 * Usage:
 *   const { getAuthHeaders, address } = useWalletAuth();
 *   const headers = await getAuthHeaders();
 *   await fetch("/api/twin/connect", { method: "POST", headers, ... });
 */

import { useCallback, useEffect, useRef } from "react";
import { useSignMessage, useSmartAccountClient, useUser } from "@account-kit/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { logger } from "@/lib/utils/logger";

const CACHE_LIFETIME_MS = 4 * 60 * 1000; // refresh well before the server's 5-min window

interface AuthCache {
  address: string;
  timestamp: number;
  signature: string;
  expiresAt: number;
}

export interface AuthHeaders {
  "X-Wallet-Address": string;
  "X-Wallet-Timestamp": string;
  "X-Wallet-Signature": string;
  // Index signature so the headers can flow into `fetch({ headers })` and
  // `Record<string, string>` consumers without a cast.
  [key: string]: string;
}

function buildMessage(address: string, timestamp: number): string {
  // Must mirror buildWalletAuthMessage on the server.
  return `Authorize Creative TV request for address ${address.toLowerCase()} at ${timestamp}`;
}

export function useWalletAuth() {
  const user = useUser();
  const { smartAccountClient, address: smartAccountAddress } = useModularAccount();
  const { client: fallbackClient } = useSmartAccountClient({});
  const accountClient = smartAccountClient || fallbackClient;
  const address = (smartAccountAddress || user?.address || "").toLowerCase();

  const cacheRef = useRef<AuthCache | null>(null);
  const pendingRef = useRef<{
    resolve: (sig: string) => void;
    reject: (err: Error) => void;
  } | null>(null);

  const { signMessage } = useSignMessage({
    client: accountClient || undefined,
    onSuccess: (sig: string) => {
      pendingRef.current?.resolve(sig);
      pendingRef.current = null;
    },
    onError: (err: Error) => {
      pendingRef.current?.reject(err);
      pendingRef.current = null;
    },
  });

  // Drop the cache when the active address changes (account switch / sign-out).
  useEffect(() => {
    if (cacheRef.current && cacheRef.current.address !== address) {
      cacheRef.current = null;
    }
  }, [address]);

  const getAuthHeaders = useCallback(async (): Promise<AuthHeaders> => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    const now = Date.now();
    const cached = cacheRef.current;
    if (cached && cached.address === address && cached.expiresAt > now) {
      return {
        "X-Wallet-Address": cached.address,
        "X-Wallet-Timestamp": String(cached.timestamp),
        "X-Wallet-Signature": cached.signature,
      };
    }

    const timestamp = Math.floor(now / 1000);
    const message = buildMessage(address, timestamp);

    const signature = await new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      try {
        signMessage({ message });
      } catch (err) {
        pendingRef.current = null;
        reject(err instanceof Error ? err : new Error("signMessage failed"));
      }
    });

    cacheRef.current = {
      address,
      timestamp,
      signature,
      expiresAt: now + CACHE_LIFETIME_MS,
    };

    logger.debug("useWalletAuth: cached new auth signature", {
      address,
      expiresAt: cacheRef.current.expiresAt,
    });

    return {
      "X-Wallet-Address": address,
      "X-Wallet-Timestamp": String(timestamp),
      "X-Wallet-Signature": signature,
    };
  }, [address, signMessage]);

  const clearAuthCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  return {
    address: address || null,
    getAuthHeaders,
    clearAuthCache,
    /** Whether signMessage is wired up — false if the smart account client isn't ready yet. */
    isReady: !!accountClient && !!address,
  };
}
