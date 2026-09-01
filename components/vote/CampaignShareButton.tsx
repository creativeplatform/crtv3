"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { ShareDialog } from "@/components/Videos/ShareDialog";

interface CampaignShareButtonProps {
  campaignId: string;
  campaignTitle: string;
}

export function CampaignShareButton({
  campaignId,
  campaignTitle,
}: CampaignShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setIsOpen(true)}
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      <ShareDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        videoTitle={campaignTitle}
        videoId={campaignId}
        shareUrlOverride={`/vote/${campaignId}`}
        titleOverride={campaignTitle}
        dialogTitle="Share Campaign"
        shareNoun="campaign"
      />
    </>
  );
}
