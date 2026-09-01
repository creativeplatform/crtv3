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

interface CreatorPredictButtonProps {
  /** Creator wallet address this page is about. */
  creatorAddress: string;
  creatorName?: string;
  onCreated?: () => void;
  className?: string;
}

/**
 * Predict button for the Creator page action row, mirroring VideoPredictButton.
 *
 * NOTE: predictions are NOT linked to the creator the way video predictions
 * link via prediction_video_links — the link registry is video-only today.
 * Markets created from this page land in the general market list (/predict);
 * no per-creator strip exists yet. See the open follow-up in the crtv3 skill.
 */
export function CreatorPredictButton({
  creatorAddress,
  creatorName,
  onCreated,
  className = "",
}: CreatorPredictButtonProps) {
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
      aria-label={`Create a prediction about this creator`}
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
              {creatorName
                ? `Make a prediction about ${creatorName}'s success.`
                : "Make a prediction about this creator."}
            </DialogDescription>
          </DialogHeader>
          <CreatePrediction
            embedded
            defaultCategory={"general" as PredictionCategoryValue}
            successHref={`/creator/${creatorAddress}`}
            onCreated={handleCreated}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}