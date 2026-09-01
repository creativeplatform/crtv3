"use client";

import { Twitter } from "lucide-react";
import {
  CHONES_X_HANDLE,
  CHONES_X_URL,
  NEARCHOS_X_HANDLE,
  NEARCHOS_X_URL,
} from "@/lib/chones/social";
import { cn } from "@/lib/utils";

type ChonesXFollowStripProps = {
  className?: string;
};

export function ChonesXFollowStrip({ className }: ChonesXFollowStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-medium text-foreground">
        <Twitter className="h-4 w-4" aria-hidden />
        Follow
      </span>
      <a
        href={CHONES_X_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md px-2 py-1 text-amber-600 transition hover:bg-amber-500/10 hover:text-amber-500 dark:text-amber-300"
      >
        @{CHONES_X_HANDLE}
      </a>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <a
        href={NEARCHOS_X_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md px-2 py-1 text-amber-600 transition hover:bg-amber-500/10 hover:text-amber-500 dark:text-amber-300"
      >
        @{NEARCHOS_X_HANDLE}
      </a>
    </div>
  );
}
