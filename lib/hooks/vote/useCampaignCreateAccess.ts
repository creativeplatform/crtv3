"use client";

import { useMemo } from "react";
import { isPlatformAdmin } from "@/lib/access/platform-admin";
import { hasValidBrandPass } from "@/lib/access/creator-membership";
import { useMembershipVerification } from "@/lib/hooks/unlock/useMembershipVerification";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";

export function useCampaignCreateAccess() {
  const { isConnected, walletAddress, smartAccountAddress } = useWalletStatus();
  const { membershipDetails, isLoading, isVerified } = useMembershipVerification();

  const address = smartAccountAddress || walletAddress;
  const isAdmin = isPlatformAdmin(address);
  const hasBrand = hasValidBrandPass(membershipDetails);

  const canCreateCampaign = useMemo(() => {
    if (!isConnected || !address) return false;
    if (isAdmin) return true;
    return hasBrand;
  }, [isConnected, address, isAdmin, hasBrand]);

  return {
    canCreateCampaign,
    isAdmin,
    hasBrand,
    isLoading,
    isConnected,
    isVerified,
    address,
  };
}
