"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PublicLockV14Json from "@unlock-protocol/contracts/dist/abis/PublicLock/PublicLockV14.json";
import {
  type Address,
  type Abi,
  createPublicClient,
  getAddress,
  http,
  isAddress,
} from "viem";
import { useSmartAccountClient, useUser } from "@/lib/wallet/react";
import { getLensChain, resolveLensRpcUrl } from "@/lib/sdk/lens/chains";

type UseSeason2UnlockKeyArgs = {
  lockAddress: string | null | undefined;
};

export type Season2UnlockKeyState = {
  hasValidKey: boolean;
  isLoading: boolean;
  error: string | null;
  ownerAddress: Address | null;
  refetch: () => Promise<void>;
};

const season2UnlockPublicClient = createPublicClient({
  chain: getLensChain("mainnet"),
  transport: http(resolveLensRpcUrl("mainnet")),
});

export function useSeason2UnlockKey({
  lockAddress,
}: UseSeason2UnlockKeyArgs): Season2UnlockKeyState {
  const user = useUser();
  const { client, address: clientAddress } = useSmartAccountClient({});
  const ownerAddress =
    (client?.account?.address as Address | undefined) ??
    (clientAddress as Address | undefined) ??
    (user?.address as Address | undefined) ??
    null;

  const [hasValidKey, setHasValidKey] = useState(false);
  const [isLoading, setIsLoading] = useState(
    Boolean(lockAddress && isAddress(lockAddress)),
  );
  const [error, setError] = useState<string | null>(null);
  const activeRequestRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!lockAddress || !isAddress(lockAddress)) {
      setHasValidKey(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!ownerAddress) {
      setHasValidKey(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++activeRequestRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const lock = getAddress(lockAddress);
      const result = await season2UnlockPublicClient.readContract({
        address: lock,
        abi: PublicLockV14Json.abi as Abi,
        functionName: "getHasValidKey",
        args: [ownerAddress],
      });
      if (requestId === activeRequestRef.current) {
        setHasValidKey(Boolean(result));
      }
    } catch (err) {
      console.error("[useSeason2UnlockKey]", err);
      if (requestId === activeRequestRef.current) {
        setHasValidKey(false);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to check Season 2 Unlock key",
        );
      }
    } finally {
      if (requestId === activeRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [lockAddress, ownerAddress]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    hasValidKey,
    isLoading,
    error,
    ownerAddress,
    refetch,
  };
}
