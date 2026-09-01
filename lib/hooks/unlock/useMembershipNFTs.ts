"use client";

import { useState, useEffect } from "react";
import { useUser, useSmartAccountClient } from "@/lib/wallet/react";
import { unlockService } from "@/lib/sdk/unlock/services";
import type { LockAddress } from "@/lib/sdk/unlock/services";
import { logger } from '@/lib/utils/logger';


export interface MembershipNFT {
  lockName: LockAddress;
  lockAddress: string;
  tokenId: string;
  metadata: {
    name: string;
    description: string;
    image: string;
    externalUrl?: string;
    version?: number;
  } | null;
}

export function useMembershipNFTs() {
  const user = useUser();
  const { client } = useSmartAccountClient({});
  const [nfts, setNfts] = useState<MembershipNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchNFTs = async () => {
      if (!user) {
        setNfts([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get the address to check
        let address: string | undefined;
        if (user.type === "eoa") {
          address = user.address;
        } else if (client?.account?.address) {
          address = client.account.address;
        }

        if (!address) {
          setNfts([]);
          setIsLoading(false);
          return;
        }

        const membershipNFTs = await unlockService.getAllMembershipNFTs(address);
        setNfts(membershipNFTs);
      } catch (err) {
        logger.error("Error fetching membership NFTs:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch membership NFTs"));
        setNfts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFTs();
  }, [user, client?.account?.address]);

  return { nfts, isLoading, error };
}
