"use client";

import { cn } from "@/lib/utils";
import { CreativePixelsSteps } from "./CreativePixelsSteps";

type SongCupPreviewPanelProps = {
  title: string;
  description?: string;
  showVideo?: boolean;
  className?: string;
};

const PIXELS_TITLE = "Create with Pixels";

export function SongCupPreviewPanel({
  title,
  description = "",
  showVideo = true,
  className,
}: SongCupPreviewPanelProps) {
  return (
    <div className={cn("flex h-full flex-col gap-6", className)}>
      <div className="space-y-2">
        <h2 className="text-2xl font-black uppercase italic tracking-wide text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4 rounded-xl border border-fuchsia-500/20 bg-background/80 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-fuchsia-600 dark:text-fuchsia-300">
            Information
          </h3>

          {title === PIXELS_TITLE ? (
            <CreativePixelsSteps />
          ) : (
            <>
              <p className="text-sm text-foreground">
                Details, rules, and links for this section go here. Replace this
                placeholder with the real copy and media for the selected tab.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-700 dark:text-fuchsia-100">
                  Web3 native
                </span>
                <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-700 dark:text-fuchsia-100">
                  Member-only
                </span>
                <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-700 dark:text-fuchsia-100">
                  Rewards
                </span>
              </div>
            </>
          )}
        </div>

        {showVideo && (
          <div className="rounded-xl border border-fuchsia-500/20 bg-background/80 p-4">
            <div className="aspect-video w-full rounded-lg bg-gradient-to-br from-fuchsia-950/60 to-violet-950/60 flex items-center justify-center">
              <span className="text-sm font-medium text-white">Video preview placeholder</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Featured video / trailer / tutorial for this section.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
