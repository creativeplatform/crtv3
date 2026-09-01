/**
 * Lens feed used for Creative TV live-stream chat ("going live" posts + comments).
 *
 * This is platform-wide live streaming — NOT Songchain / Hack Beta / Chones.
 * Create a dedicated Feed in the Lens dashboard and set:
 *   NEXT_PUBLIC_LIVE_LENS_FEED_ID=0x…
 *
 * Optional fallbacks exist only so existing deployments keep working until
 * the live-specific feed is configured.
 */

import { normalizeLensPrimitiveId } from "@/lib/sdk/lens/primitive-id";

function readEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * Feed contract address for live-stream going-live posts.
 * Prefer NEXT_PUBLIC_LIVE_LENS_FEED_ID.
 */
export function getLiveLensFeedId(): string | null {
  const primary = normalizeLensPrimitiveId(
    readEnv("NEXT_PUBLIC_LIVE_LENS_FEED_ID", "LIVE_LENS_FEED_ID")
  );
  if (primary) return primary;

  // Temporary fallbacks for older env setups (not preferred)
  return normalizeLensPrimitiveId(
    readEnv(
      "NEXT_PUBLIC_CREATIVE_TV_LIVE_FEED_ID",
      "NEXT_PUBLIC_SONGCHAIN_FEED_ID",
      "SONGCHAIN_FEED_ID"
    )
  );
}

export function getLiveLensFeedConfigError(): string | null {
  if (getLiveLensFeedId()) return null;
  return (
    "Live Lens feed is not configured. Create a Feed in the Lens dashboard " +
    "and set NEXT_PUBLIC_LIVE_LENS_FEED_ID to that feed address."
  );
}

export function buildGoingLivePostContent(params: {
  streamName: string;
  watchUrl?: string | null;
}): string {
  const name = params.streamName.trim() || "Live stream";
  return [
    `🔴 LIVE now: ${name}`,
    params.watchUrl ? `Watch: ${params.watchUrl}` : null,
    "Chat in the comments — this is our live stream conversation.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
