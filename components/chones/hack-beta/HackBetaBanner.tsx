"use client";

import { ChonesBanner } from "@/components/chones/ChonesBanner";
import { cn } from "@/lib/utils";

type HackBetaBannerProps = {
  className?: string;
};

/** @deprecated Prefer HackBetaHero / ChonesBanner; kept for any remaining imports. */
export function HackBetaBanner({ className }: HackBetaBannerProps) {
  return (
    <ChonesBanner
      className={cn(className)}
      href="/chones/hack-beta"
      buttonLabel="ENTER"
    />
  );
}
