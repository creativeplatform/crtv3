import { Livepeer } from "livepeer";
import { fullLivepeer } from "@/lib/sdk/livepeer/fullClient";

/**
 * Best-effort server-side lookup for a Livepeer asset's thumbnail URL.
 * Returns null if the asset isn't ready yet or no thumbnail source is published.
 */
export async function getClipThumbnailUrl(playbackId: string): Promise<string | null> {
  if (!playbackId) return null;
  try {
    const response = await fullLivepeer.playback.get(playbackId);
    const sources = (response.playbackInfo?.meta?.source ?? []) as Array<{
      type?: string;
      hrn?: string;
      url?: string;
    }>;
    const thumbnail = sources.find(
      (src) => src.type === "image/png" && src.hrn === "Thumbnail (PNG)"
    );
    return thumbnail?.url ?? null;
  } catch {
    return null;
  }
}

export async function createClip({
  playbackId,
  sessionId,
  startTime,
  endTime,
  name,
}: {
  playbackId: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  name?: string;
}): Promise<{ playbackUrl: string; assetId: string; newPlaybackId: string; error?: string }> {
  if (!playbackId || !sessionId || !startTime || !endTime)
    return { playbackUrl: "", assetId: "", newPlaybackId: "", error: "Missing required fields" };
  try {
    const result = await fullLivepeer.stream.createClip({
      playbackId,
      startTime,
      endTime,
      name,
      sessionId,
    });
    const playbackUrl = result.data?.asset.playbackUrl ?? "";
    const assetId = result.data?.asset.id ?? "";
    const newPlaybackId = result.data?.asset.playbackId ?? "";
    if (!playbackUrl)
      return {
        playbackUrl: "",
        assetId,
        newPlaybackId,
        error: "Clip created but playback URL not ready yet.",
      };
    return { playbackUrl, assetId, newPlaybackId };
  } catch (e: any) {
    return {
      playbackUrl: "",
      assetId: "",
      newPlaybackId: "",
      error: e?.message ?? "Unknown error",
    };
  }
}
