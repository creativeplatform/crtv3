import { video, MediaVideoMimeType, MetadataLicenseType } from '@lens-protocol/metadata';
import type { VideoAsset } from '@/lib/types/video-asset';
import { getSrc } from '@livepeer/react/external';

function siteOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://tv.creativeplatform.xyz'
  );
}

function thumbnailFromAsset(asset: VideoAsset): string | undefined {
  const thumb =
    asset.thumbnailUri ||
    (asset as { thumbnail_url?: string }).thumbnail_url ||
    undefined;
  return thumb?.trim() || undefined;
}

export async function resolveVideoPlaybackUrl(playbackId: string): Promise<string | null> {
  if (!playbackId?.trim()) return null;
  try {
    const response = await fetch(
      `/api/internal/playback-info?playbackId=${encodeURIComponent(playbackId)}`,
    );
    if (!response.ok) return null;
    const res = await response.json();
    const sources = getSrc(res) as Array<{ src: string; type?: string }>;
    const mp4 = sources?.find((s) => s.type?.includes('mp4') || s.src?.includes('.mp4'));
    if (mp4?.src) return mp4.src;
    if (sources?.[0]?.src) return sources[0].src;
  } catch {
    // Fall through to watch URL
  }
  return `${siteOrigin()}/watch/${playbackId}`;
}

export async function buildLensVideoMetadataFromAsset(
  asset: VideoAsset,
  caption: string,
) {
  const playbackUrl = await resolveVideoPlaybackUrl(asset.playback_id);
  const discoverUrl = `${siteOrigin()}/discover/${asset.asset_id}`;
  const trimmedCaption = caption.trim();
  const content =
    trimmedCaption.length > 0
      ? `${trimmedCaption}\n\nWatch on Creative TV: ${discoverUrl}`
      : `Watch on Creative TV: ${discoverUrl}`;

  return video({
    title: asset.title,
    content,
    video: {
      item: playbackUrl ?? discoverUrl,
      type: MediaVideoMimeType.MP4,
      cover: thumbnailFromAsset(asset),
      license: MetadataLicenseType.CCO,
    },
    locale: 'en',
  });
}
