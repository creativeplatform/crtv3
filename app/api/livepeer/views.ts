import { serverLogger } from '@/lib/utils/logger';

/** Prefer full-access key for Studio data routes; fall back to LIVEPEER_API_KEY (same key in most setups). */
export function resolveLivepeerStudioAuthToken(): string | undefined {
  const full = process.env.LIVEPEER_FULL_API_KEY?.trim();
  const standard = process.env.LIVEPEER_API_KEY?.trim();
  return full || standard || undefined;
}

export function livepeerStudioApiBaseUrl(): string {
  const raw =
    process.env.LIVEPEER_FULL_API_URL?.trim() || 'https://livepeer.studio';
  return raw.replace(/\/$/, '');
}

export const fetchAllViews = async (
  playbackId: string,
): Promise<{
  playbackId: string;
  viewCount: number;
  playtimeMins: number;
  legacyViewCount: number;
} | null> => {
  const token = resolveLivepeerStudioAuthToken();
  if (!token) {
    serverLogger.warn(
      'Livepeer view metrics skipped: set LIVEPEER_FULL_API_KEY or LIVEPEER_API_KEY',
    );
    return null;
  }

  const myHeaders = new Headers();
  myHeaders.append('Authorization', `Bearer ${token}`);

  const requestOptions = {
    method: 'GET',
    headers: myHeaders,
    redirect: 'follow' as const,
    cache: 'no-store' as const,
  };

  try {
    const base = livepeerStudioApiBaseUrl();
    const response = await fetch(
      `${base}/api/data/views/query/total/${encodeURIComponent(playbackId)}`,
      requestOptions,
    );

    if (!response.ok) {
      throw new Error(
        `Error fetching views: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      playbackId: String(data.playbackId ?? playbackId),
      viewCount: Number(data.viewCount ?? 0) || 0,
      playtimeMins: Number(data.playtimeMins ?? 0) || 0,
      legacyViewCount: Number(data.legacyViewCount ?? 0) || 0,
    };
  } catch (error) {
    serverLogger.error('Failed to fetch view metrics:', error);
    return null;
  }
};
