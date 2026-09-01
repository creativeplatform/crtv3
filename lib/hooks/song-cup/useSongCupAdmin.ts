"use client";

import { useMemo } from "react";
import { useCreatorWalletAddress } from "@/lib/hooks/accountkit/useCreatorWalletAddress";
import { isSongCupAdminWallet } from "@/lib/songchain/song-cup/admin-config";

export function useSongCupAdmin() {
  const { creatorAddress, smartAccountAddress, eoaAddress, isLoading } =
    useCreatorWalletAddress();

  // Admin lists store smart-wallet addresses; also accept EOA if listed.
  const isAdmin = useMemo(
    () =>
      isSongCupAdminWallet(smartAccountAddress) ||
      isSongCupAdminWallet(eoaAddress),
    [smartAccountAddress, eoaAddress],
  );

  return {
    isAdmin,
    walletAddress: creatorAddress,
    isLoading,
  };
}
