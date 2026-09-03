"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

export type EarnVaultData = {
  id: string;
  name: string;
  provider: string;
  userApyPercent: string | null;
  tvlUsd: number | null;
  availableLiquidityUsd: number | null;
  assetSymbol: string;
  assetDecimals: number;
};

export type EarnPositionData = {
  assetsInVault: string;
  assetsInVaultFormatted: string;
  totalDeposited: string;
  totalWithdrawn: string;
  earnedYield: string;
  earnedYieldFormatted: string;
  sharesInVault: string;
  assetSymbol: string;
  assetDecimals: number;
};

export type EarnEmbeddedWalletData = {
  walletId: string;
  address: string;
  usdcBalance: string;
};

type EarnActionStatus = "pending" | "succeeded" | "rejected" | "failed";

const TERMINAL_STATUSES = new Set<EarnActionStatus>([
  "succeeded",
  "rejected",
  "failed",
]);

async function authFetch(
  getAccessToken: () => Promise<string | null>,
  input: string,
  init?: RequestInit,
) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Request failed",
    );
  }
  return payload;
}

async function pollEarnAction(
  getAccessToken: () => Promise<string | null>,
  actionId: string,
  walletId: string,
): Promise<EarnActionStatus> {
  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const payload = await authFetch(
      getAccessToken,
      `/api/earn/actions/${actionId}?walletId=${encodeURIComponent(walletId)}`,
    );
    const status = payload.action?.status as EarnActionStatus;
    if (TERMINAL_STATUSES.has(status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Timed out waiting for transaction confirmation");
}

export function useEarn(options: { isVisible?: boolean } = {}) {
  const { authenticated, getAccessToken } = usePrivy();
  const { isVisible = true } = options;

  const [vault, setVault] = useState<EarnVaultData | null>(null);
  const [position, setPosition] = useState<EarnPositionData | null>(null);
  const [embeddedWallet, setEmbeddedWallet] =
    useState<EarnEmbeddedWalletData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const fetchVault = useCallback(async () => {
    const response = await fetch("/api/earn/vault");
    if (response.status === 503) {
      setIsConfigured(false);
      return null;
    }
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load vault");
    }
    setIsConfigured(true);
    setVault(payload.vault as EarnVaultData);
    return payload.vault as EarnVaultData;
  }, []);

  const fetchPosition = useCallback(async () => {
    const payload = await authFetch(
      getAccessTokenRef.current,
      "/api/earn/position",
    );
    setPosition(payload.position as EarnPositionData);
    setEmbeddedWallet(payload.embeddedWallet as EarnEmbeddedWalletData);
    return payload;
  }, []);

  const refetch = useCallback(async () => {
    if (!authenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchVault(), fetchPosition()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load earn data");
    } finally {
      setIsLoading(false);
    }
  }, [authenticated, fetchPosition, fetchVault]);

  useEffect(() => {
    if (!authenticated || !isVisible) return;
    void refetch();
  }, [authenticated, isVisible, refetch]);

  const deposit = useCallback(
    async (amount: string) => {
      setIsPending(true);
      setError(null);
      try {
        const payload = await authFetch(
          getAccessTokenRef.current,
          "/api/earn/deposit",
          {
            method: "POST",
            body: JSON.stringify({ amount }),
          },
        );
        const status = await pollEarnAction(
          getAccessTokenRef.current,
          payload.action.id,
          payload.walletId,
        );
        if (status === "rejected") {
          throw new Error(
            "Deposit rejected — check your USDC balance and try again.",
          );
        }
        if (status === "failed") {
          throw new Error("Deposit failed onchain. Please try again.");
        }
        await refetch();
        return status;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Deposit failed";
        setError(message);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [refetch],
  );

  const withdraw = useCallback(
    async (args: { amount?: string; withdrawAll?: boolean }) => {
      setIsPending(true);
      setError(null);
      try {
        const payload = await authFetch(
          getAccessTokenRef.current,
          "/api/earn/withdraw",
          {
            method: "POST",
            body: JSON.stringify(args),
          },
        );
        const status = await pollEarnAction(
          getAccessTokenRef.current,
          payload.action.id,
          payload.walletId,
        );
        if (status === "rejected") {
          throw new Error("Withdrawal rejected. Please try again.");
        }
        if (status === "failed") {
          throw new Error("Withdrawal failed onchain. Please try again.");
        }
        await refetch();
        return status;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Withdrawal failed";
        setError(message);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [refetch],
  );

  return {
    vault,
    position,
    embeddedWallet,
    isLoading,
    isPending,
    error,
    isConfigured,
    refetch,
    deposit,
    withdraw,
  };
}
