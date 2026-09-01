"use client";

import { useState, useEffect } from "react";
import { useUser, useSmartAccountClient } from "@/lib/wallet/react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { VideoEditDialog } from "./VideoEditDialog";
import { getVideoAssetByAssetId } from "@/services/video-assets";
import type { VideoAsset } from "@/lib/types/video-asset";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { logger } from '@/lib/utils/logger';


interface VideoEditButtonProps {
  videoAssetId: string; // asset_id (UUID)
  creatorId: string | null;
  onVideoUpdated?: () => void;
}

export function VideoEditButton({
  videoAssetId,
  creatorId,
  onVideoUpdated,
}: VideoEditButtonProps) {
  const [isOwner, setIsOwner] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [videoAsset, setVideoAsset] = useState<VideoAsset | null>(null);
  const user = useUser();
  const { address: scaAddress } = useSmartAccountClient({});
  const { account } = useModularAccount();

  // Get the current user's address (prefer smart account, fallback to EOA)
  const smartAccountAddress = account?.address || scaAddress;
  const currentUserAddress = smartAccountAddress || user?.address;

  useEffect(() => {
    async function checkOwnership() {
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

        // If owner, fetch the full video asset for editing
        if (isVideoOwner) {
          try {
            const asset = await getVideoAssetByAssetId(videoAssetId);
            setVideoAsset(asset as VideoAsset);
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

    checkOwnership();
  }, [creatorId, currentUserAddress, videoAssetId, user?.address]);

  if (isChecking || !isOwner || !videoAsset) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsDialogOpen(true)}
        className="gap-2"
      >
        <Pencil className="h-4 w-4" />
        Edit Video
      </Button>
      <VideoEditDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        videoAsset={videoAsset}
        onSuccess={() => {
          onVideoUpdated?.();
          // Refresh the page to show updated data
          window.location.reload();
        }}
      />
    </>
  );
}

