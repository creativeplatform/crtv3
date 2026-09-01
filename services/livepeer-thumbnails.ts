import { z } from "zod";
import { createSafeActionClient } from "next-safe-action";
import type { ActionResponse } from "@/lib/types/actions";

const actionClient = createSafeActionClient();

const getThumbnailUrlSchema = z.object({
  playbackId: z.string().min(1),
});

export async function getThumbnailUrl({ playbackId }: { playbackId: string }) {
  const res = await fetch(
    `/api/internal/playback-info?playbackId=${playbackId}`
  );
  if (!res.ok)
    return {
      success: false,
      error:
        "Playback info not found. Make sure the stream is active and live.",
    } as ActionResponse;

  const data = await res.json();
  const thumbnailSource = data?.meta?.source?.find(
    (src: any) => src.type === "image/png" && src.hrn === "Thumbnail (PNG)"
  );

  if (!thumbnailSource?.url)
    return {
      success: false,
      error: "Thumbnail URL not found",
    } as ActionResponse;

  return {
    success: true,
    data: { thumbnailUrl: thumbnailSource.url },
  } as ActionResponse<{ thumbnailUrl: string }>;
}

export async function getThumbnailFromVTT({ playbackId }: { playbackId: string }) {
  try {
    const res = await fetch(
      `/api/internal/playback-info?playbackId=${playbackId}`
    );
    
    if (!res.ok) {
      return {
        success: false,
        error: "Playback info not found",
      } as ActionResponse;
    }

    const data = await res.json();
    
    // Look for VTT thumbnail source
    const vttSource = data?.meta?.source?.find(
      (src: any) => src.type === "text/vtt" && src.hrn === "Thumbnails"
    );

    if (!vttSource?.url) {
      return {
        success: false,
        error: "VTT thumbnail source not found",
      } as ActionResponse;
    }

    // Fetch VTT content
    const vttResponse = await fetch(vttSource.url);
    if (!vttResponse.ok) {
      return {
        success: false,
        error: "Failed to fetch VTT file",
      } as ActionResponse;
    }

    const vttContent = await vttResponse.text();
    
    // Parse first keyframe
    const lines = vttContent.split('\n');
    let firstKeyframe = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('-->')) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.endsWith('.jpg')) {
          firstKeyframe = nextLine;
          break;
        }
      }
    }

    if (!firstKeyframe) {
      return {
        success: false,
        error: "No keyframes found in VTT",
      } as ActionResponse;
    }

    // Construct thumbnail URL
    const baseUrl = vttSource.url.replace('/thumbnails.vtt', '');
    const thumbnailUrl = `${baseUrl}/${firstKeyframe}`;

    return {
      success: true,
      data: { thumbnailUrl },
    } as ActionResponse<{ thumbnailUrl: string }>;

  } catch (error) {
    return {
      success: false,
      error: "Failed to fetch thumbnail",
    } as ActionResponse;
  }
}
