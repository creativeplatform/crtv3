"use client";

import { useMemo } from "react";
import { useUser, useSmartAccountClient } from "@/lib/wallet/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { VIDEO_ADMIN_ADDRESS } from "@/lib/constants/admin";

export function useIsVideoAdmin(): boolean {
  const user = useUser();
  const { address: scaAddress } = useSmartAccountClient({});
  const { account } = useModularAccount();

  return useMemo(() => {
    const admin = VIDEO_ADMIN_ADDRESS.toLowerCase();
    const candidates = [
      account?.address,
      scaAddress,
      user?.address,
    ].filter(Boolean) as string[];

    return candidates.some((address) => address.toLowerCase() === admin);
  }, [account?.address, scaAddress, user?.address]);
}
