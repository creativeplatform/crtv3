"use client";

import { useWalletClientContext } from "@/lib/wallet/wallet-context";
import { useWalletChain } from "@/lib/wallet/chain-context";

/** React hook for the v5 smart wallet client (non-7702 ModularAccountV2 / sma-b). */
export function useSmartWalletClient() {
  const { client, address, isLoadingClient, error, signer, eoaAddress, refreshClient } =
    useWalletClientContext();
  const { chain, setChain } = useWalletChain();

  return {
    client,
    address,
    scaAddress: address,
    eoaAddress,
    signer,
    chain,
    setChain,
    isLoadingClient,
    error,
    refreshClient,
  };
}
