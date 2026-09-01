import { convertFailingGateway } from "@/lib/utils/image-gateway";

/** First visible character of a handle, uppercased — avatar fallback. */
export function initial(handle: string): string {
  return (handle.trim()[0] || "?").toUpperCase();
}

/** Normalize Lens/IPFS avatar URLs for SVG <image> rendering. */
export function clubAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return url;
  return convertFailingGateway(url);
}
