"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useSmartAccountClient } from "@/lib/wallet/react";
import { Button } from "@/components/ui/button";
import { DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatEther } from "viem";
import { getVideoAssetByAssetId } from "@/services/video-assets";
import { distributeSplitRevenue, getCreatorMeTokenAddress, getSplitBalance } from "@/services/splits";
import type { VideoAsset } from "@/lib/types/video-asset";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import type { Address } from "viem";
import { Badge } from "@/components/ui/badge";
import { logger } from '@/lib/utils/logger';


interface VideoSplitDistributeButtonProps {
  videoAssetId: string; // asset_id (UUID) - used to fetch video asset
  creatorId: string | null;
  splitsAddress?: string | null; // Optional - will be fetched if not provided
}

export function VideoSplitDistributeButton({
  videoAssetId,
  creatorId,
  splitsAddress: providedSplitsAddress,
}: VideoSplitDistributeButtonProps) {
  const [isOwner, setIsOwner] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);
  const [videoAsset, setVideoAsset] = useState<VideoAsset | null>(null);
  const [splitsAddress, setSplitsAddress] = useState<string | null>(providedSplitsAddress || null);
  const [availableBalance, setAvailableBalance] = useState<bigint | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [meTokenSymbol, setMeTokenSymbol] = useState<string | null>(null);
  const user = useUser();
  const { client: smartAccountClient } = useSmartAccountClient({ type: 'MultiOwnerModularAccount' });
  const { account } = useModularAccount();

  // Get the current user's address (prefer smart account, fallback to EOA)
  const smartAccountAddress = account?.address;
  const currentUserAddress = smartAccountAddress || user?.address;

  useEffect(() => {
    async function checkOwnershipAndSplits() {
      if (!creatorId || !currentUserAddress) {
        setIsOwner(false);
        setIsChecking(false);
        return;
      }

      try {
        // Normalize addresses for comparison
        const normalizedCreatorId = creatorId.toLowerCase();
        const normalizedUserAddress = currentUserAddress.toLowerCase();

        // Check if user is the owner (either EOA or Smart Account)
        const isVideoOwner =
          normalizedCreatorId === normalizedUserAddress ||
          !!(user?.address &&
            normalizedCreatorId === user.address.toLowerCase());

        setIsOwner(isVideoOwner);

        // If owner, fetch the full video asset to check for splits
        if (isVideoOwner) {
          try {
            const asset = await getVideoAssetByAssetId(videoAssetId);
            setVideoAsset(asset as VideoAsset);

            // Use provided splits address or fetch from asset
            const assetSplitsAddress = providedSplitsAddress || (asset as VideoAsset)?.splits_address;
            setSplitsAddress(assetSplitsAddress || null);
          } catch (error) {
            logger.error("Error fetching video asset:", error);
          }
        }
      } catch (error) {
        logger.error("Error checking ownership:", error);
        setIsOwner(false);
      } finally {
        setIsChecking(false);
      }
    }

    checkOwnershipAndSplits();
  }, [creatorId, currentUserAddress, videoAssetId, user?.address, providedSplitsAddress]);

  // Fetch split balance and meToken symbol
  const fetchBalance = useCallback(async () => {
    if (!videoAsset || !splitsAddress || !smartAccountClient) {
      return;
    }

    setIsLoadingBalance(true);
    try {
      // Fetch video asset to get creator meToken info
      const videoResponse = await fetch(`/api/video-assets/${videoAsset.id}`);
      if (!videoResponse.ok) {
        setIsLoadingBalance(false);
        return;
      }
      const videoResult = await videoResponse.json();
      const videoData = videoResult.data || videoResult;

      if (!videoData?.creator_metoken_id) {
        setIsLoadingBalance(false);
        return;
      }

      // Fetch meToken by ID to get address and symbol
      const meTokenResponse = await fetch(`/api/metokens/by-id/${videoData.creator_metoken_id}`);
      if (!meTokenResponse.ok) {
        setIsLoadingBalance(false);
        return;
      }
      const meTokenResult = await meTokenResponse.json();
      const meToken = meTokenResult.data || meTokenResult;
      const meTokenAddress = meToken?.address;

      if (!meTokenAddress) {
        setIsLoadingBalance(false);
        return;
      }

      // Set symbol for display
      setMeTokenSymbol(meToken?.symbol || null);

      // Get the split balance
      const balanceResult = await getSplitBalance(
        splitsAddress as Address,
        meTokenAddress as Address,
        smartAccountClient
      );

      if (balanceResult.success && balanceResult.balance !== undefined) {
        setAvailableBalance(balanceResult.balance);
      }
    } catch (error) {
      logger.error("Error fetching split balance:", error);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [videoAsset, splitsAddress, smartAccountClient?.account?.address]);

  // Fetch balance when component is ready and periodically
  useEffect(() => {
    if (!isOwner || !splitsAddress || !videoAsset || !smartAccountClient) {
      return;
    }

    // Fetch immediately
    fetchBalance();

    // Refresh balance every 30 seconds
    const interval = setInterval(() => {
      fetchBalance();
    }, 30000);

    return () => clearInterval(interval);
  }, [isOwner, splitsAddress, videoAsset, smartAccountClient?.account?.address, fetchBalance]);

  const handleDistribute = async () => {
    if (!videoAsset || !splitsAddress || !smartAccountClient) {
      toast.error("Missing required information to distribute revenue");
      return;
    }

    setIsDistributing(true);
    try {
      // Get the creator's meToken address
      const meTokenAddress = await getCreatorMeTokenAddress(videoAsset.id);

      if (!meTokenAddress) {
        toast.error("Creator must have a meToken to distribute revenue");
        setIsDistributing(false);
        return;
      }

      toast.info("Distributing revenue to collaborators...");

      // Distribute the creator's meToken to all collaborators
      const result = await distributeSplitRevenue(
        splitsAddress as Address,
        meTokenAddress,
        smartAccountClient
      );

      if (result.success) {
        // Refresh balance after successful distribution
        await fetchBalance();

        toast.success("Revenue distributed successfully!", {
          description: result.txHash
            ? `Transaction: ${result.txHash.slice(0, 10)}...`
            : "Collaborators have been paid in your meToken",
        });
      } else {
        toast.error("Failed to distribute revenue", {
          description: result.error || "Please try again",
        });
      }
    } catch (error) {
      logger.error("Error distributing revenue:", error);
      toast.error("Failed to distribute revenue", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsDistributing(false);
    }
  };

  // Only show button if:
  // 1. User is the owner
  // 2. Video has a splits address
  // 3. Smart account client is available
  if (isChecking || !isOwner || !splitsAddress || !smartAccountClient) {
    return null;
  }

  // Format balance for display
  const formatBalance = (balance: bigint | null): string => {
    if (balance === null || balance === undefined) return "0";
    const formatted = formatEther(balance);
    const num = parseFloat(formatted);

    if (num === 0) return "0";
    if (num < 0.00001) return num.toExponential(3);
    if (num < 1) return num.toFixed(6).replace(/\.?0+$/, '');
    return num.toLocaleString(undefined, {
      maximumFractionDigits: 4,
      minimumFractionDigits: 0
    });
  };

  const balanceDisplay = isLoadingBalance
    ? "Loading..."
    : formatBalance(availableBalance);
  const hasBalance = availableBalance !== null && availableBalance > 0n;

  return (
    <div className="flex flex-col items-end gap-2">
      {hasBalance && (
        <Badge
          variant="secondary"
          className="text-xs font-semibold"
        >
          {balanceDisplay} {meTokenSymbol || "tokens"} available
        </Badge>
      )}
      <Button
        variant={hasBalance ? "default" : "outline"}
        size="sm"
        onClick={handleDistribute}
        disabled={isDistributing || !hasBalance}
        className="gap-2"
      >
        {isDistributing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Distributing...
          </>
        ) : (
          <>
            <DollarSign className="h-4 w-4" />
            Distribute Revenue
          </>
        )}
      </Button>
    </div>
  );
}

