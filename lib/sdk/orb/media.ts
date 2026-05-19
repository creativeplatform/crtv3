import { createSDK } from '@orbclub/modules';
import { mediaPlugin } from '@orbclub/modules/media';
import { getOrbMediaConfig } from '@/lib/sdk/orb/config';

const mediaConfig = getOrbMediaConfig();
const sdk = createSDK({
  plugins: [mediaPlugin(mediaConfig)],
});

/** URIs that should use Orb media resolution before IPFS gateway fallbacks. */
export function shouldResolveWithOrbMedia(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return false;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (/\.(m3u8|mp4|mov|webm)(\?|$)/i.test(trimmed)) return false;
    if (trimmed.includes('livepeer')) return false;
    return false;
  }
  return (
    trimmed.startsWith('ipfs://') ||
    trimmed.startsWith('grove://') ||
    trimmed.startsWith('lens://') ||
    trimmed.startsWith('ar://') ||
    trimmed.includes('thumbnailDimension')
  );
}

export function resolveOrbImageUrl(
  url: string | null | undefined,
  dimension = mediaConfig.defaultThumbnailDimension ?? 768,
): string | null {
  if (!url || !shouldResolveWithOrbMedia(url)) return url ?? null;
  return sdk.media.parseImage(url, dimension);
}

export function resolveOrbMediaUrl(
  url: string | null | undefined,
  opts?: { type?: 'image' | 'audio' | 'video'; dimension?: number },
): string | null {
  if (!url || !shouldResolveWithOrbMedia(url)) return url ?? null;
  if (opts?.type === 'audio') return sdk.media.parseAudio(url);
  if (opts?.type === 'video') return sdk.media.parseVideo(url);
  return sdk.media.parse(url, {
    type: opts?.type ?? 'image',
    dimension: opts?.dimension,
  });
}
