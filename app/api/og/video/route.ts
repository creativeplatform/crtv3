import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import dns from "node:dns";
import path from "node:path";
import {
  getVideoAssetByAssetId,
  getVideoAssetByPlaybackId,
} from "@/services/video-assets";
import { convertFailingGateway } from "@/lib/utils/image-gateway";
import { serverLogger } from "@/lib/utils/logger";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 8_000;
const CACHE_HEADER =
  "public, s-maxage=86400, stale-while-revalidate=604800";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Host suffixes permitted for remote OG thumbnail fetches (SSRF mitigation). */
const ALLOWED_HOST_SUFFIXES = [
  "creativeplatform.xyz",
  "ipfs.io",
  "dweb.link",
  "w3s.link",
  "cf-ipfs.com",
  "gateway.ipfscdn.io",
  "4everland.io",
  "pinata.cloud",
  "gateway.pinata.cloud",
  "grove.storage",
  "api.grove.storage",
  "lighthouse.storage",
  "gateway.lighthouse.storage",
  "livepeer.studio",
  "livepeercdn.com",
  "livepeercdn.studio",
  "lp-playback.studio",
  "vod-cdn.lp-playback.studio",
  "storage.googleapis.com",
  "cloudflare-ipfs.com",
  "orb.club",
  "vercel-storage.com",
  "public.blob.vercel-storage.com",
] as const;

async function fallbackImage(): Promise<NextResponse> {
  const filePath = path.join(process.cwd(), "public", "Creative_TV.png");
  const buffer = await readFile(filePath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHE_HEADER,
    },
  });
}

function isPrivateIp(ip: string): boolean {
  if (
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    ip.startsWith("0.")
  ) {
    return true;
  }
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1] ?? "", 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (
    ip === "::1" ||
    ip.startsWith("fe80:") ||
    ip.startsWith("fc00:") ||
    ip.startsWith("fd00:")
  ) {
    return true;
  }
  return false;
}

function isAllowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "[::1]"
  ) {
    return false;
  }
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

async function isSafeRemoteThumbnailUrl(url: string): Promise<boolean> {
  if (!url) return false;
  if (url.includes("storage.googleapis.com/lp-ai-generate-com")) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (!isAllowedHostname(parsed.hostname)) return false;

  try {
    const addresses = await dns.promises.lookup(parsed.hostname, { all: true });
    if (addresses.length === 0) return false;
    if (addresses.some(({ address }) => isPrivateIp(address))) return false;
  } catch {
    return false;
  }

  return true;
}

async function fetchRemoteImage(
  url: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // Manual redirects so each hop is re-checked against the allowlist.
    let current = url;
    for (let hop = 0; hop < 3; hop++) {
      if (!(await isSafeRemoteThumbnailUrl(current))) return null;
      const res = await fetch(current, {
        signal: controller.signal,
        headers: { Accept: "image/*,*/*" },
        redirect: "manual",
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }

      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType && !contentType.startsWith("image/")) return null;
      const body = await res.arrayBuffer();
      if (!body.byteLength) return null;
      return {
        body,
        contentType: contentType.startsWith("image/")
          ? contentType
          : "image/jpeg",
      };
    }
    return null;
  } catch (err) {
    serverLogger.warn("OG video image fetch failed:", { url, err });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function livepeerThumbnailFallback(
  playbackId: string
): Promise<string | null> {
  try {
    const { getClipThumbnailUrl } = await import("@/services/livepeer-clips");
    const lpThumb = await getClipThumbnailUrl(playbackId);
    if (lpThumb?.trim()) return convertFailingGateway(lpThumb.trim());
  } catch (err) {
    serverLogger.warn("OG video: Livepeer thumbnail fallback failed", err);
  }
  return null;
}

async function resolveThumbnailUrl(
  id: string | null,
  playbackId: string | null
): Promise<string | null> {
  if (id) {
    if (!UUID_REGEX.test(id)) return null;
    const asset = await getVideoAssetByAssetId(id).catch((err) => {
      serverLogger.warn("OG video: getVideoAssetByAssetId failed", err);
      return null;
    });
    const typed = asset as {
      thumbnail_url?: string | null;
      playback_id?: string | null;
    } | null;
    const raw = typed?.thumbnail_url;
    if (raw?.trim()) return convertFailingGateway(raw.trim());

    // Discover pages pass asset id only — fall back to Livepeer via playback_id
    const assetPlaybackId = typed?.playback_id?.trim();
    if (assetPlaybackId) {
      const lpThumb = await livepeerThumbnailFallback(assetPlaybackId);
      if (lpThumb) return lpThumb;
    }
  }

  if (playbackId) {
    const asset = await getVideoAssetByPlaybackId(playbackId).catch((err) => {
      serverLogger.warn("OG video: getVideoAssetByPlaybackId failed", err);
      return null;
    });
    const raw = asset?.thumbnail_url;
    if (raw?.trim()) return convertFailingGateway(raw.trim());

    // Fallback: fetch thumbnail directly from Livepeer API
    if (!raw) {
      const lpThumb = await livepeerThumbnailFallback(playbackId);
      if (lpThumb) return lpThumb;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");
    const playbackId = searchParams.get("playbackId");

    if (!id && !playbackId) {
      return fallbackImage();
    }

    const thumbnailUrl = await resolveThumbnailUrl(id, playbackId);

    if (thumbnailUrl) {
      // Try the primary URL first
      if (await isSafeRemoteThumbnailUrl(thumbnailUrl)) {
        const remote = await fetchRemoteImage(thumbnailUrl);
        if (remote) {
          return new NextResponse(remote.body, {
            status: 200,
            headers: {
              "Content-Type": remote.contentType,
              "Cache-Control": CACHE_HEADER,
            },
          });
        }
      }

      // If primary URL failed and it's an IPFS URL, try fallback gateways
      const { getAllIpfsGateways } = await import("@/lib/utils/image-gateway");
      const gatewayUrls = getAllIpfsGateways(thumbnailUrl);
      for (const gatewayUrl of gatewayUrls) {
        if (gatewayUrl === thumbnailUrl) continue; // Already tried
        if (await isSafeRemoteThumbnailUrl(gatewayUrl)) {
          const remote = await fetchRemoteImage(gatewayUrl);
          if (remote) {
            serverLogger.debug("OG video: fetched via fallback gateway", { gatewayUrl });
            return new NextResponse(remote.body, {
              status: 200,
              headers: {
                "Content-Type": remote.contentType,
                "Cache-Control": CACHE_HEADER,
              },
            });
          }
        }
      }
    }

    return fallbackImage();
  } catch (error) {
    serverLogger.error("OG video route error:", error);
    try {
      return await fallbackImage();
    } catch {
      return new NextResponse("OG image unavailable", { status: 500 });
    }
  }
}
