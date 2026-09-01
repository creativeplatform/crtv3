"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MEMBERSHIP_TIERS } from "@/lib/access/membership-tiers";
import { MembershipIcon } from "./MembershipIcon";

type MembershipFeaturesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTierIndex?: number;
};

export function MembershipFeaturesModal({
  open,
  onOpenChange,
  defaultTierIndex = 0,
}: MembershipFeaturesModalProps) {
  const [activeTier, setActiveTier] = useState(defaultTierIndex);

  useEffect(() => {
    if (open) {
      setActiveTier(defaultTierIndex);
    }
  }, [open, defaultTierIndex]);

  const tier = MEMBERSHIP_TIERS[activeTier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,720px)] w-[calc(100%-2rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="text-base sm:text-lg">
            Membership Tiers &amp; Features
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 px-4 pt-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {MEMBERSHIP_TIERS.map((t, index) => (
              <button
                key={t.address}
                type="button"
                onClick={() => setActiveTier(index)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  index === activeTier
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.name.replace("Creative ", "")}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:pb-6">
          {tier && (
            <div className="min-w-0 rounded-xl border border-border bg-gradient-to-br from-card to-secondary/50 p-4 sm:p-5">
              <div className="mb-1 flex min-w-0 items-center gap-2">
                <MembershipIcon
                  name="star"
                  className="shrink-0 text-primary"
                />
                <h3 className="min-w-0 break-words text-base font-bold sm:text-lg">
                  {tier.name}
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                {tier.priceLabel}
              </p>
              <ul className="space-y-2.5">
                {tier.detailedFeatures.map((feature) => (
                  <li key={feature} className="flex min-w-0 items-start text-sm">
                    <MembershipIcon
                      name="check"
                      className="mr-2 mt-0.5 shrink-0 text-primary"
                    />
                    <span className="min-w-0 break-words text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
