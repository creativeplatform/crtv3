"use client";

import { useMemo } from "react";
import { useCreatorWalletAddress } from "@/lib/hooks/accountkit/useCreatorWalletAddress";
import { isHackBetaAdminWallet } from "@/lib/chones/hack-beta/admin-config";

export function useHackBetaAdmin() {
  const { creatorAddress, smartAccountAddress, eoaAddress, isLoading } =
    useCreatorWalletAddress();

  // Admin lists store smart-wallet addresses; also accept EOA if listed.
  const isAdmin = useMemo(
    () =>
      isHackBetaAdminWallet(smartAccountAddress) ||
      isHackBetaAdminWallet(eoaAddress),
    [smartAccountAddress, eoaAddress],
  );

  return {
    isAdmin,
    walletAddress: creatorAddress,
    isLoading,
  };
}
