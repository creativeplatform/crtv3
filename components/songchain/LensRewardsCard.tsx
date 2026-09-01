"use client";

import { useLensRewards } from "@/hooks/useLensRewards";
import { Gift, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LensRewardsCard() {
  const { totalGho, ghoRewards, loading, error, refresh } = useLensRewards();

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-700 dark:text-violet-200">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Lens rewards…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        <p className="font-medium">Rewards unavailable</p>
        <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p>
      </div>
    );
  }

  const hasRewards = ghoRewards.length > 0;

  return (
    <div className="rounded-md border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Gift className="mt-0.5 h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300" />
          <div>
            <p className="font-medium text-violet-900 dark:text-violet-100">
              {hasRewards ? "Lens rewards earned" : "Lens rewards"}
            </p>
            <p className="text-violet-800 dark:text-violet-200">
              {hasRewards
                ? `You've earned ${totalGho} GHO from Lens Smart Token Distributions.`
                : "Connect and use your Orb account on Lens to become eligible for GHO rewards."}
            </p>
            {ghoRewards.length > 0 && (
              <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">
                {ghoRewards.length} distribution{ghoRewards.length === 1 ? "" : "s"} · rewards show up in your connected wallet on Lens
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
          onClick={() => void refresh()}
          aria-label="Refresh rewards"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
