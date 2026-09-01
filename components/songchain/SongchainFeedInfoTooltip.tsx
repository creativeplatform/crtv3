"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getFeedDiagnosticInfo } from "@/lib/songchain/feed-diagnostics";

type SongchainFeedInfoTooltipProps = {
  feedId: string | null;
  className?: string;
};

export function SongchainFeedInfoTooltip({ feedId, className }: SongchainFeedInfoTooltipProps) {
  const info = getFeedDiagnosticInfo(feedId);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`
              inline-flex items-center justify-center rounded-full p-1
              text-muted-foreground transition-colors hover:text-fuchsia-400
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500
              ${className ?? ""}
            `}
            aria-label="Feed info"
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs space-y-1 text-xs">
          <p>
            <span className="font-medium text-foreground">Lens network:</span>{" "}
            {info.lensNetworkLabel}
          </p>
          <p className="break-all">
            <span className="font-medium text-foreground">Feed:</span>{" "}
            <code className="text-[10px]">{info.feedIdDisplay}</code>
          </p>
          {info.lensNetwork === "testnet" && (
            <p className="text-[10px] text-muted-foreground">
              Set <code className="text-[10px]">NEXT_PUBLIC_LENS_ENV=production</code> for mainnet feeds.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
