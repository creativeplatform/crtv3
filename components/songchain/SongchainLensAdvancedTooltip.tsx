"use client";

import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SongchainLensAdvancedTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-violet-200/90 hover:text-white"
            aria-label="Advanced Lens features"
          >
            <Info className="h-3.5 w-3.5" />
            Lens admin
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-4 text-sm" side="bottom">
          <p className="font-semibold text-foreground mb-2">
            Advanced Lens features
          </p>
          <p className="text-muted-foreground mb-2">
            Boost engagement, custom feed creation, feed rules, and post rules are
            configured on-chain via Lens — not yet in Creative TV UI. Use the Lens
            dashboard for:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-muted-foreground mb-3">
            <li>Custom feeds and feed rule contracts</li>
            <li>Post rules and moderation policies</li>
            <li>Sponsored / boost flows where supported</li>
          </ul>
          <Link
            href="https://lens.xyz/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300"
          >
            Lens documentation
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
