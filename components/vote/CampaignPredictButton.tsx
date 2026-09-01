"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { CreatePrediction } from "@/components/predictions/CreatePrediction";
import { usePredictionAccess } from "@/lib/hooks/predictions/usePredictionAccess";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import type { PredictionCategoryValue } from "@/lib/predictions/categories";

export const CAMPAIGN_PREDICTION_PRESETS: {
  id: string;
  label: string;
  title: string;
  description: string;
  closeDays: number;
}[] = [
  {
    id: "yes-wins",
    label: "Yes will win",
    title: 'Will the "[CAMPAIGN_TITLE]" campaign pass with a Yes majority?',
    description:
      "Resolves Yes if the winning choice has more voting power than every other choice when voting closes.",
    closeDays: 14,
  },
  {
    id: "high-turnout",
    label: "10+ total votes",
    title: 'Will "[CAMPAIGN_TITLE]" reach 10 total votes?',
    description:
      "Resolves Yes once the campaign's total vote count reaches 10 when voting closes.",
    closeDays: 21,
  },
];

interface CampaignPredictButtonProps {
  campaignId: string;
  campaignTitle: string;
  onCreated?: () => void;
  className?: string;
}

/**
 * Predict button for the campaign vote page action row, mirroring
 * VideoPredictButton / CreatorPredictButton.
 *
 * NOTE: campaign predictions are NOT linked to the campaign — the link
 * registry (prediction_video_links) is video-only today. Markets land in
 * the general /predict list. See open follow-up in the crtv3 skill.
 */
export function CampaignPredictButton({
  campaignId,
  campaignTitle,
  onCreated,
  className = "",
}: CampaignPredictButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { isConnected } = useWalletStatus();
  const { canCreatePrediction, blockReason, isLoading } = usePredictionAccess();

  const handleCreated = () => {
    onCreated?.();
    router.refresh();
  };

  const disabled = !isConnected || isLoading || !canCreatePrediction;
  const blocked = !isLoading && !canCreatePrediction && Boolean(blockReason);

  const button = (
    <Button
      variant="ghost"
      size="sm"
      className={`gap-2 hover:scale-105 transition-transform ${className}`}
      disabled={disabled}
      onClick={() => setOpen(true)}
      aria-label="Create a prediction about this campaign"
    >
      <TrendingUp className="h-4 w-4" />
      <span className="text-sm font-medium">Predict</span>
    </Button>
  );

  return (
    <>
      <TooltipProvider delayDuration={100}>
        {blocked ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>{blockReason}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          button
        )}
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Prediction</DialogTitle>
            <DialogDescription>
              {campaignTitle
                ? `Make a prediction about the "${campaignTitle}" campaign's outcome.`
                : "Make a prediction about this campaign."}
            </DialogDescription>
          </DialogHeader>
          <CreatePrediction
            embedded
            defaultCategory={"general" as PredictionCategoryValue}
            successHref={`/vote/${campaignId}`}
            onCreated={handleCreated}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}