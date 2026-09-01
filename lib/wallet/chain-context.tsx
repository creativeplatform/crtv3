"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Chain } from "viem";
import { defaultWalletChain } from "./chains";

type WalletChainContextValue = {
  chain: Chain;
  setChain: (args: { chain: Chain }) => void;
  isSettingChain: boolean;
};

const WalletChainContext = createContext<WalletChainContextValue | null>(null);

export function WalletChainProvider({ children }: { children: ReactNode }) {
  const [chain, setChainState] = useState<Chain>(defaultWalletChain);
  const [isSettingChain, setIsSettingChain] = useState(false);

  const setChain = useCallback(({ chain: nextChain }: { chain: Chain }) => {
    setIsSettingChain(true);
    setChainState(nextChain);
    setIsSettingChain(false);
  }, []);

  const value = useMemo(
    () => ({ chain, setChain, isSettingChain }),
    [chain, setChain, isSettingChain],
  );

  return (
    <WalletChainContext.Provider value={value}>
      {children}
    </WalletChainContext.Provider>
  );
}

export function useWalletChain() {
  const ctx = useContext(WalletChainContext);
  if (!ctx) {
    throw new Error("useWalletChain must be used within WalletChainProvider");
  }
  return ctx;
}
