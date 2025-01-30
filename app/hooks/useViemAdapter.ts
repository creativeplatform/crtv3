'use client';

import { useActiveAccount } from "thirdweb/react";
import { useCallback } from "react";
import { thirdwebAccountToViemWallet, viemWalletToThirdwebAccount } from "@app/lib/sdk/thirdweb/viem-adapter";
import type { WalletClient } from "viem";

export function useViemAdapter() {
  const activeAccount = useActiveAccount();

  const getViemWallet = useCallback(() => {
    if (!activeAccount) {
      throw new Error("No active account found");
    }
    return thirdwebAccountToViemWallet(activeAccount);
  }, [activeAccount]);

  const convertViemWallet = useCallback((walletClient: WalletClient) => {
    return viemWalletToThirdwebAccount(walletClient);
  }, []);

  return {
    getViemWallet,
    convertViemWallet,
    activeAccount,
  };
}
