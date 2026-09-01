import {
  livepeerStudioApiBaseUrl,
  resolveLivepeerStudioAuthToken,
} from "@/lib/sdk/livepeer/studioAuth";

function authHeaders(): HeadersInit {
  const token = resolveLivepeerStudioAuthToken();
  if (!token) {
    throw new Error("LIVEPEER_NOT_CONFIGURED");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function sanitizeLivepeerId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

export type LivepeerStreamSession = {
  id: string;
  parentId?: string;
  recordingStatus?: string;
  recordingUrl?: string;
  mp4Url?: string;
  sourceSegmentsDuration?: number;
  createdAt?: number;
};

export type LivepeerAssetSource = {
  type?: string;
  sessionId?: string;
  streamId?: string;
};

export type LivepeerAssetSummary = {
  id: string;
  name?: string;
  playbackId?: string;
  playbackUrl?: string;
  source?: LivepeerAssetSource;
  videoSpec?: { duration?: number };
  status?: { phase?: string };
};

export async function enableStreamRecording(streamId: string, record: boolean = true): Promise<void> {
  const base = livepeerStudioApiBaseUrl();
  const res = await fetch(`${base}/api/stream/${streamId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ record }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to ${record ? "enable" : "disable"} stream recording: ${res.status} ${text}`);
  }
}

export async function getStreamSessions(
  streamId: string,
  options?: { record?: boolean }
): Promise<LivepeerStreamSession[]> {
  const base = livepeerStudioApiBaseUrl();
  const params = new URLSearchParams();
  if (options?.record) params.set("record", "true");
  const qs = params.toString();
  const url = `${base}/api/stream/${streamId}/sessions${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch stream sessions: ${res.status} ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getLivepeerAsset(assetId: string): Promise<LivepeerAssetSummary | null> {
  const safeAssetId = sanitizeLivepeerId(assetId);
  if (!safeAssetId) return null;

  const base = livepeerStudioApiBaseUrl();
  const res = await fetch(`${base}/api/asset/${encodeURIComponent(safeAssetId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.asset ?? data) as LivepeerAssetSummary;
}

export async function listRecentRecordingAssets(limit = 20): Promise<LivepeerAssetSummary[]> {
  const base = livepeerStudioApiBaseUrl();
  const res = await fetch(
    `${base}/api/asset?limit=${limit}&order=createdAt-false`,
    { headers: authHeaders() }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const assets = Array.isArray(data) ? data : [];
  return assets.filter((a: LivepeerAssetSummary) => a.source?.type === "recording");
}
