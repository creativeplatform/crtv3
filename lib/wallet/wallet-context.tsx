"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePrivy, useWallets, toViemAccount } from "@privy-io/react-auth";
import type { LocalAccount } from "viem/accounts";
import type { Address } from "viem";
import { useWalletChain } from "./chain-context";
import {
  createCompatSmartAccountClient,
  type CompatSmartAccountClient,
} from "./smart-wallet-client";

type WalletClientContextValue = {
  signer: LocalAccount | undefined;
  eoaAddress: Address | undefined;
  client: CompatSmartAccountClient | undefined;
  address: Address | undefined;
  isLoadingClient: boolean;
  error: Error | null;
  refreshClient: () => void;
};

const WalletClientContext = createContext<WalletClientContextValue | null>(null);

export function WalletClientProvider({ children }: { children: ReactNode }) {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const { chain } = useWalletChain();
  const privyWallet = wallets.find((w) => w.walletClientType === "privy");

  const [signer, setSigner] = useState<LocalAccount | undefined>();
  const [client, setClient] = useState<CompatSmartAccountClient | undefined>();
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshClient = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSigner() {
      const privyWallet = wallets.find((w) => w.walletClientType === "privy");
      if (!ready || !authenticated || !privyWallet) {
        setSigner(undefined);
        setClient(undefined);
        setError(null);
        return;
      }

      try {
        const account = await toViemAccount({ wallet: privyWallet });
        if (!cancelled) setSigner(account as LocalAccount);
      } catch (err) {
        if (!cancelled) {
          setSigner(undefined);
          setError(err instanceof Error ? err : new Error("Failed to load signer"));
        }
      }
    }

    void loadSigner();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, wallets, refreshToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadClient() {
      if (!signer) {
        setClient(undefined);
        return;
      }

      setIsLoadingClient(true);
      setError(null);
      try {
        const nextClient = await createCompatSmartAccountClient(signer, chain);
        if (!cancelled) setClient(nextClient);
      } catch (err) {
        if (!cancelled) {
          setClient(undefined);
          setError(err instanceof Error ? err : new Error("Failed to load wallet client"));
        }
      } finally {
        if (!cancelled) setIsLoadingClient(false);
      }
    }

    void loadClient();
    return () => {
      cancelled = true;
    };
  }, [signer, chain, refreshToken]);

  const value = useMemo<WalletClientContextValue>(
    () => ({
      signer,
      eoaAddress: signer?.address,
      client,
      address: client?.scaAddress,
      isLoadingClient:
        !ready ||
        (authenticated && !error && (!privyWallet || !signer)) ||
        isLoadingClient,
      error,
      refreshClient,
    }),
    [signer, client, isLoadingClient, ready, authenticated, privyWallet, error, refreshClient],
  );

  return (
    <WalletClientContext.Provider value={value}>
      {children}
    </WalletClientContext.Provider>
  );
}

export function useWalletClientContext() {
  const ctx = useContext(WalletClientContext);
  if (!ctx) {
    throw new Error("useWalletClientContext must be used within WalletClientProvider");
  }
  return ctx;
}
