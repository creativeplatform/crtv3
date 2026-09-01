import { liveStream } from '@lens-protocol/metadata';

export type StreamSummary = {
  playback_id: string;
  name?: string | null;
  thumbnail_url?: string | null;
  last_live_at?: string | null;
  is_live?: boolean;
};

function siteOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://tv.creativeplatform.xyz'
  );
}

export function buildLensLiveStreamMetadata(stream: StreamSummary, caption: string) {
  const origin = siteOrigin();
  const watchUrl = `${origin}/watch/${stream.playback_id}`;
  const trimmedCaption = caption.trim();
  const title = stream.name?.trim() || 'Live on Creative TV';
  const content =
    trimmedCaption.length > 0
      ? `${trimmedCaption}\n\n${watchUrl}`
      : `I'm live on Creative TV — ${watchUrl}`;

  return liveStream({
    title,
    content,
    liveUrl: watchUrl,
    playbackUrl: watchUrl,
    startsAt: stream.last_live_at ?? new Date().toISOString(),
    checkLiveAPI: `${origin}/api/streams/${encodeURIComponent(stream.playback_id)}/live-status`,
    locale: 'en',
  });
}
