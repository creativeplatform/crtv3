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

interface VideoPredictButtonProps {
  videoAssetId: string;
  videoTitle?: string;
  onCreated?: () => void;
  className?: string;
}

export function VideoPredictButton({
  videoAssetId,
  videoTitle,
  onCreated,
  className = "",
}: VideoPredictButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { isConnected } = useWalletStatus();
  const { canCreatePrediction, blockReason, isLoading } = usePredictionAccess();

  // After a successful create, refresh the page's server components so the
  // strip re-fetches links and shows the new pending card immediately.
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
      aria-label="Create prediction for this video"
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
              {videoTitle
                ? `Make a prediction about "${videoTitle}".`
                : "Make a prediction about this video."}
            </DialogDescription>
          </DialogHeader>
          <CreatePrediction
            embedded
            defaultCategory="general"
            successHref={`/discover/${videoAssetId}`}
            videoAssetId={videoAssetId}
            onCreated={handleCreated}
            showPresets
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
