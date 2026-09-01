"use client";

import { useMemo } from "react";
import { isPlatformAdmin } from "@/lib/access/platform-admin";
import {
  hasValidCreatorPass,
  hasValidBrandPass,
} from "@/lib/access/creator-membership";
import { useMembershipVerification } from "@/lib/hooks/unlock/useMembershipVerification";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";

export const PREDICTION_BLOCK_MESSAGE =
  "Creator memberships cannot create or bet on predictions — this keeps markets fair for fans.";

export function usePredictionAccess() {
  const { isConnected, walletAddress, smartAccountAddress } = useWalletStatus();
  const { membershipDetails, isLoading } = useMembershipVerification();

  const address = smartAccountAddress || walletAddress;

  const isAdmin = isPlatformAdmin(address);
  const isCreatorTier = hasValidCreatorPass(membershipDetails);
  const isBrandTier = hasValidBrandPass(membershipDetails);
  // Only Creator tier is blocked from prediction create/bet.
  const isBlockedTier = isCreatorTier;

  const canCreatePrediction = useMemo(() => {
    if (!isConnected || !address) return false;
    if (isAdmin) return true;
    if (isBlockedTier) return false;
    return true;
  }, [isConnected, address, isAdmin, isBlockedTier]);

  const canBetOnPrediction = canCreatePrediction;

  const blockReason =
    isAdmin || !isBlockedTier ? null : PREDICTION_BLOCK_MESSAGE;

  return {
    canCreatePrediction,
    canBetOnPrediction,
    isAdmin,
    isCreatorTier,
    isBrandTier,
    isBlockedTier,
    blockReason,
    isLoading,
    isConnected,
    address,
  };
}
