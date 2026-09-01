"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import type { Address } from "viem";
import { HeartBitClient } from "@/lib/sdk/heartbit/client";
import {
  DEFAULT_HEARTBIT_CHAIN,
  type HeartBitChain,
} from "@/lib/sdk/heartbit/config";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";

type HeartBitContextValue = {
  mintHeartBit: (opts: {
    startTime: number;
    endTime: number;
    hash: string;
    account: string;
  }) => Promise<void>;
  getTotalHeartBitByHash: (opts: { hash: string }) => Promise<number>;
  getTotalHeartMintsByUser: (opts: {
    hash: string;
    account: string;
  }) => Promise<number>;
};

const HeartBitContext = createContext<HeartBitContextValue | null>(null);

/**
 * Local HeartBit provider (compatible surface with @fileverse/heartbit-react).
 * Minting goes through our unsigned API route (smart-account safe).
 */
export function HeartBitProvider({
  children,
  chain = DEFAULT_HEARTBIT_CHAIN,
}: {
  children: React.ReactNode;
  chain?: HeartBitChain;
}) {
  const client = useMemo(() => new HeartBitClient(chain), [chain]);
  const { getAuthHeaders } = useWalletAuth();

  const mintHeartBit = useCallback(
    async (opts: {
      startTime: number;
      endTime: number;
      hash: string;
      account: string;
    }) => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/heartbit/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "HeartBit mint failed");
      }
    },
    [getAuthHeaders]
  );

  const getTotalHeartBitByHash = useCallback(
    async ({ hash }: { hash: string }) => client.getTotalHeartBitByHash(hash),
    [client]
  );

  const getTotalHeartMintsByUser = useCallback(
    async ({ hash, account }: { hash: string; account: string }) =>
      client.getTotalHeartMintsByUser(hash, account as Address),
    [client]
  );

  const value = useMemo(
    () => ({
      mintHeartBit,
      getTotalHeartBitByHash,
      getTotalHeartMintsByUser,
    }),
    [mintHeartBit, getTotalHeartBitByHash, getTotalHeartMintsByUser]
  );

  return (
    <HeartBitContext.Provider value={value}>{children}</HeartBitContext.Provider>
  );
}

export function useHeartBit(): HeartBitContextValue {
  const ctx = useContext(HeartBitContext);
  if (!ctx) {
    throw new Error("useHeartBit must be used within HeartBitProvider");
  }
  return ctx;
}
