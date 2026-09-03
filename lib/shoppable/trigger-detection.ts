import { Client } from "@upstash/qstash";
import { getLivepeerAsset } from "@/app/api/livepeer/assetUploadActions";
import { serverLogger } from "@/lib/utils/logger";

function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function getQStash(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token });
}

/** Pick the lowest preferred static MP4 rendition (360p → 480p → any downloadUrl). */
export function pickLowResMp4Url(asset: {
  downloadUrl?: string | null;
  playbackUrl?: string | null;
  status?: { phase?: string } | null;
  files?: Array<{ type?: string; url?: string; resolution?: string | null }> | null;
}): string | null {
  const files = asset.files ?? [];
  const mp4s = files.filter(
    (f) =>
      f.url &&
      (f.type === "staticTranscodedMp4" ||
        f.type === "video/mp4" ||
        f.url.includes(".mp4"))
  );

  const prefer = ["360p", "360", "480p", "480"];
  for (const res of prefer) {
    const match = mp4s.find((f) =>
      (f.resolution || "").toLowerCase().includes(res.replace("p", ""))
    );
    if (match?.url) return match.url;
  }

  if (mp4s[0]?.url) return mp4s[0].url;
  return asset.downloadUrl || null;
}

export type QueueDetectionResult =
  | { ok: true; queued: true; messageId?: string }
  | { ok: false; status: 202 | 503; reason: string };

export async function queueVideoDetection(payload: {
  campaignId: string;
  videoId: string;
  livepeerAssetId: string;
  productImageUrl: string;
  productKitId: string;
}): Promise<QueueDetectionResult> {
  let asset;
  try {
    asset = await getLivepeerAsset(payload.livepeerAssetId);
  } catch (err) {
    serverLogger.warn("[queueVideoDetection] asset fetch failed", err);
    return {
      ok: false,
      status: 202,
      reason: "Livepeer asset not ready",
    };
  }

  const phase = asset?.status?.phase;
  const videoDownloadUrl = pickLowResMp4Url(asset as Parameters<typeof pickLowResMp4Url>[0]);

  if (phase !== "ready" || !videoDownloadUrl) {
    return {
      ok: false,
      status: 202,
      reason: "Static MP4 not ready yet",
    };
  }

  const qstash = getQStash();
  if (!qstash) {
    serverLogger.error("[queueVideoDetection] QSTASH_TOKEN missing");
    return {
      ok: false,
      status: 503,
      reason: "QStash is not configured",
    };
  }

  const baseUrl = getAppBaseUrl();
  const result = await qstash.publishJSON({
    url: `${baseUrl}/api/campaigns/worker/detect`,
    body: {
      campaignId: payload.campaignId,
      videoId: payload.videoId,
      videoDownloadUrl,
      productImageUrl: payload.productImageUrl,
      productKitId: payload.productKitId,
    },
    retries: 3,
    delay: "5s",
    deduplicationId: `detect-${payload.videoId}`,
  });

  return {
    ok: true,
    queued: true,
    messageId: result.messageId,
  };
}
