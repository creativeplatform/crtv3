import type { LivepeerAssetSummary } from "@/lib/livepeer/studio-api";

export type LivepeerWebhookPayload = {
  event?: string;
  streamId?: string;
  asset?: LivepeerAssetSummary;
  assetId?: string;
  event_object?: Record<string, unknown>;
  session?: { id?: string };
  sessionId?: string;
};

export function parseSignatureHeader(header: string): Record<string, string> {
  return header.split(",").reduce<Record<string, string>>((acc, part) => {
    const eq = part.indexOf("=");
    if (eq === -1) return acc;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key && value) acc[key] = value;
    return acc;
  }, {});
}

export function extractStreamIdFromWebhook(
  payload: LivepeerWebhookPayload
): string | undefined {
  if (payload.streamId) return payload.streamId;

  const obj = payload.event_object;
  if (!obj || typeof obj !== "object") return undefined;

  const event = payload.event ?? "";

  if (event.startsWith("stream.") && typeof obj.id === "string") {
    return obj.id;
  }

  if (typeof obj.parentId === "string") {
    return obj.parentId;
  }

  const source = obj.source as { streamId?: string } | undefined;
  if (source?.streamId) return source.streamId;

  return undefined;
}

export function extractAssetFromWebhook(
  payload: LivepeerWebhookPayload
): LivepeerAssetSummary | undefined {
  if (payload.asset?.id) return payload.asset;

  const obj = payload.event_object;
  if (!obj || typeof obj !== "object") return undefined;

  if (payload.event?.startsWith("asset.") && typeof obj.id === "string") {
    return obj as LivepeerAssetSummary;
  }

  return undefined;
}

export function extractAssetIdFromWebhook(
  payload: LivepeerWebhookPayload
): string | undefined {
  const fromPayload = payload.assetId ?? payload.asset?.id;
  if (fromPayload) return fromPayload;

  const obj = payload.event_object;
  if (payload.event?.startsWith("asset.") && typeof obj?.id === "string") {
    return obj.id;
  }

  return undefined;
}
