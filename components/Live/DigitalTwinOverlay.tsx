"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  creatorProfileSupabaseService,
  type CreatorProfile,
} from "@/lib/sdk/supabase/creator-profiles";
import { TwinChatPanel } from "./TwinChatPanel";
import { logger } from "@/lib/utils/logger";

// Lazy-load the R3F canvas so the ~600KB three.js bundle isn't shipped on
// pages where the creator hasn't configured a 3D twin avatar.
const TwinAvatarCanvas = dynamic(
  () => import("./TwinAvatarCanvas").then((m) => m.TwinAvatarCanvas),
  { ssr: false }
);

interface DigitalTwinOverlayProps {
  creatorAddress?: string | null;
  /** Override the position; defaults to bottom-right corner. */
  className?: string;
}

/**
 * Renders the creator's digital twin alongside their broadcast/playback view.
 *
 * - GLB set → 3D R3F avatar in a transparent corner box (overlays the player).
 * - chat endpoint set → small "Chat with my twin" panel anchored bottom-right.
 * - neither → renders nothing (zero layout impact).
 */
export function DigitalTwinOverlay({
  creatorAddress,
  className,
}: DigitalTwinOverlayProps) {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!creatorAddress) {
      setProfile(null);
      return;
    }
    (async () => {
      try {
        const result = await creatorProfileSupabaseService.getCreatorProfileByOwner(
          creatorAddress
        );
        if (!cancelled) setProfile(result);
      } catch (err) {
        logger.error("Failed to load creator profile for twin overlay:", err);
        if (!cancelled) setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creatorAddress]);

  if (!profile?.twin_enabled) return null;

  const username = profile.username || "creator";

  if (profile.twin_avatar_glb_url) {
    return (
      <div
        className={
          className ||
          "absolute bottom-4 right-4 w-48 h-48 z-30 pointer-events-none"
        }
      >
        <TwinAvatarCanvas glbUrl={profile.twin_avatar_glb_url} />
      </div>
    );
  }

  if (profile.twin_chat_endpoint && creatorAddress) {
    return (
      <TwinChatPanel
        creatorAddress={creatorAddress}
        creatorName={username}
        className={className}
      />
    );
  }

  return null;
}
