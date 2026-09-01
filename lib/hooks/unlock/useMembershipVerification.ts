"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/lib/wallet/react";

import {
  unlockService,
  type LockAddress,
  type LockAddressValue,
  type MembershipError,
  fetchLockAndKey,
} from "../../sdk/unlock/services";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";

export interface MembershipDetails {
  name: LockAddress;
  address: LockAddressValue;
  isValid: boolean;
  lock: any | null; // Type from Unlock Protocol
  expiration?: number;
  tokenId?: string | null;
}

export interface MembershipStatus {
  isVerified: boolean;
  hasMembership: boolean;
  isLoading: boolean;
  error: MembershipError | null;
  membershipDetails?: MembershipDetails[];
  walletType?: "eoa" | "sca";
  walletAddress?: string;
  refetch: () => Promise<void>;
}

export function useMembershipVerification() {
  const user = useUser();
  const {
    smartAccountClient: client,
    address: modularAddress,
    loading: isModularLoading,
  } = useModularAccount();

  const [status, setStatus] = useState<Omit<MembershipStatus, "refetch">>({
    isVerified: false,
    hasMembership: false,
    isLoading: true,
    error: null,
  });

  const verifyMembership = useCallback(
    async (address: string, walletType: "eoa" | "sca") => {
      try {
        const memberships = await unlockService.getAllMemberships(address);
        const hasMembership = memberships.some(({ isValid }) => isValid);

        setStatus({
          isVerified: true,
          hasMembership,
          isLoading: false,
          error: null,
          membershipDetails: memberships,
          walletType,
          walletAddress: address,
        });
      } catch (error) {
        const membershipError = error as MembershipError;
        setStatus({
          isVerified: false,
          hasMembership: false,
          isLoading: false,
          error: membershipError,
          membershipDetails: [],
          walletType,
          walletAddress: address,
        });
      }
    },
    []
  );

  const refetch = useCallback(async () => {
    const userAddress = user?.address;

    if (!userAddress) {
      setStatus({
        isVerified: false,
        hasMembership: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    setStatus((prev) => ({ ...prev, isLoading: true }));

    try {
      if (user?.type === "eoa") {
        await verifyMembership(userAddress, "eoa");
        return;
      }

      const scaAddress = client?.account?.address ?? modularAddress ?? null;
      const waitingForClient = isModularLoading;

      if (!scaAddress) {
        if (waitingForClient) {
          setStatus((prev) =>
            prev.isLoading ? prev : { ...prev, isLoading: true },
          );
          return;
        }

        setStatus({
          isVerified: false,
          hasMembership: false,
          isLoading: false,
          error: {
            name: "Error",
            message: "No valid address found for verification",
            code: "NO_VALID_ADDRESS",
          } as MembershipError,
        });
        return;
      }

      await verifyMembership(scaAddress, "sca");
    } catch (error) {
      const membershipError = error as MembershipError;
      setStatus({
        isVerified: false,
        hasMembership: false,
        isLoading: false,
        error: membershipError,
      });
    }
  }, [
    user?.address,
    user?.type,
    client?.account?.address,
    modularAddress,
    isModularLoading,
    verifyMembership,
  ]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { ...status, refetch };
}

export interface UseUnlockNFTParams {
  lockAddress: string;
  userAddress: string;
  network: number;
}

export function useUnlockNFT({
  lockAddress,
  userAddress,
  network,
}: UseUnlockNFTParams) {
  const [data, setData] = useState<{ lock: any; key: any } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lockAddress || !userAddress) return;
    setIsLoading(true);
    fetchLockAndKey({ lockAddress, userAddress, network })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [lockAddress, userAddress, network]);

  return { data, isLoading, error };
}

interface UseUnlockNFTApiParams {
  lockAddress: string;
  userAddress: string;
  network: number;
  enabled?: boolean;
}

interface UnlockNFTApiResult {
  data: { lock: any; key: any } | null;
  isLoading: boolean;
  error: string | null;
}

export function useUnlockNFTApi({
  lockAddress,
  userAddress,
  network,
  enabled = true,
}: UseUnlockNFTApiParams): UnlockNFTApiResult {
  const [data, setData] = useState<{ lock: any; key: any } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !lockAddress || !userAddress) return;
    setIsLoading(true);
    setError(null);
    fetch("/api/unlock-nft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockAddress, userAddress, network }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [lockAddress, userAddress, network, enabled]);

  return { data, isLoading, error };
}
