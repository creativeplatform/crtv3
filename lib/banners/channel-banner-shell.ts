import { cn } from "@/lib/utils";

/**
 * Shared channel-banner frame — Song Cup is the sizing source of truth.
 * Mobile: content-driven height via py-5. Desktop: fixed 1024/274 aspect.
 */
export const channelBannerShellClassName =
  "relative mx-auto h-full w-full max-w-7xl overflow-hidden rounded-xl py-5 lg:aspect-[1024/274] lg:py-0";

/** Centered content column used by Song Cup / Chones banners. */
export const channelBannerContentClassName =
  "relative z-10 flex h-full flex-col items-center justify-center gap-2 px-3 lg:gap-2 lg:px-4";

export function channelBannerShell(extra?: string) {
  return cn(channelBannerShellClassName, extra);
}
