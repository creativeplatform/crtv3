"use client";

import { useMemo } from "react";
import { useUser, useSmartAccountClient } from "@/lib/wallet/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";

/**
 * Canonical creator identity for streams, uploads, and wallet-auth APIs.
 * Prefers the smart account address; falls back to EOA for pure EOA users.
 */
export function useCreatorWalletAddress() {
  const user = useUser();
  const { address: scaFromClient, isLoadingClient } = useSmartAccountClient({});
  const { address: scaFromModular, loading: isModularLoading } = useModularAccount();

  const smartAccountAddress = scaFromModular || scaFromClient || null;
  const eoaAddress = user?.address ?? null;

  const creatorAddress = useMemo(() => {
    return smartAccountAddress || eoaAddress || null;
  }, [smartAccountAddress, eoaAddress]);

  const signerAddress = useMemo(() => {
    if (!eoaAddress || !creatorAddress) return null;
    if (eoaAddress.toLowerCase() === creatorAddress.toLowerCase()) return null;
    return eoaAddress;
  }, [eoaAddress, creatorAddress]);

  const isLoading =
    isLoadingClient || isModularLoading || (!!user && !creatorAddress);

  return {
    creatorAddress,
    smartAccountAddress,
    eoaAddress,
    signerAddress,
    isLoading,
    isConnected: !!user?.address,
  };
}
