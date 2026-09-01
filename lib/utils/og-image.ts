/**
 * Same-origin OG/Twitter image URLs for video share previews.
 * Crawlers fetch these; the /api/og/video route proxies (or falls back) the real thumbnail.
 */

import { convertFailingGateway } from "@/lib/utils/image-gateway";

const PRODUCTION_SITE_ORIGIN = "https://tv.creativeplatform.xyz";
const DEFAULT_THUMBNAIL_PATH = "/Creative_TV.png";

/**
 * Prefer configured public site URLs over VERCEL_URL so share cards always
 * point at the custom domain (crawlers often fail on *.vercel.app preview hosts).
 */
export function getSiteOrigin(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed.replace(/\/$/, "");
    }
  }

  return PRODUCTION_SITE_ORIGIN;
}

export type VideoOgImageParams = {
  id?: string | null;
  playbackId?: string | null;
};

/**
 * Same-origin path for the OG image proxy (safe for <img src> in the share modal).
 */
export function getVideoOgImagePath({
  id,
  playbackId,
}: VideoOgImageParams): string {
  const params = new URLSearchParams();
  if (id) params.set("id", id);
  else if (playbackId) params.set("playbackId", playbackId);
  const qs = params.toString();
  return qs ? `/api/og/video?${qs}` : DEFAULT_THUMBNAIL_PATH;
}

/**
 * Absolute URL for the OG image proxy used in generateMetadata.
 */
export function getVideoOgImageUrl(params: VideoOgImageParams): string {
  return `${getSiteOrigin()}${getVideoOgImagePath(params)}`;
}

export type SharePreviewThumbnailParams = {
  videoId?: string | null;
  playbackId?: string | null;
  shareUrlOverride?: string | null;
  thumbnailUrlOverride?: string | null;
};

/**
 * Thumbnail shown in ShareDialog — prefer the same /api/og/video proxy that
 * crawlers use for discover/watch link previews so modal === unfurl.
 */
export function resolveSharePreviewThumbnail({
  videoId,
  playbackId,
  shareUrlOverride,
  thumbnailUrlOverride,
}: SharePreviewThumbnailParams): string {
  const path =
    typeof shareUrlOverride === "string" ? shareUrlOverride : "";

  const watchMatch = path.match(/\/watch\/([^/?#]+)/);
  if (watchMatch?.[1]) {
    return getVideoOgImagePath({ playbackId: decodeURIComponent(watchMatch[1]) });
  }

  const discoverMatch = path.match(/\/discover\/([^/?#]+)/);
  if (discoverMatch?.[1]) {
    return getVideoOgImagePath({ id: decodeURIComponent(discoverMatch[1]) });
  }

  // Standard video share → /discover/{videoId}
  if (!shareUrlOverride && videoId?.trim()) {
    return getVideoOgImagePath({ id: videoId.trim() });
  }

  if (thumbnailUrlOverride?.trim()) {
    return convertFailingGateway(thumbnailUrlOverride.trim());
  }

  if (playbackId?.trim()) {
    return getVideoOgImagePath({ playbackId: playbackId.trim() });
  }

  return DEFAULT_THUMBNAIL_PATH;
}

export const VIDEO_OG_IMAGE = {
  width: 1200,
  height: 630,
  alt: "Creative TV video",
  // Proxied thumbnails vary (jpeg/png/webp); omit strict type in consumers when unsure.
  type: "image/jpeg",
} as const;
