
import { logger } from '@/lib/utils/logger';
export interface ThumbnailInfo {
  thumbnailUrl: string;
  vttUrl: string;
  keyframes: Array<{
    time: string;
    filename: string;
  }>;
}

/**
 * Fetches thumbnail information for a Livepeer asset
 * @param playbackId - The Livepeer playback ID
 * @returns Promise<ThumbnailInfo | null>
 */
export async function getThumbnailInfo(playbackId: string): Promise<ThumbnailInfo | null> {
  try {
    // Fetch playback info to get the VTT URL
    const response = await fetch(`/api/internal/playback-info?playbackId=${playbackId}`);
    
    if (!response.ok) {
      logger.warn(`Failed to fetch playback info for ${playbackId}:`, response.status);
      return null;
    }

    const data = await response.json();
    
    // Find the VTT source in the playback info
    const vttSource = data?.meta?.source?.find(
      (src: any) => src.type === "text/vtt" && src.hrn === "Thumbnails"
    );

    if (!vttSource?.url) {
      logger.warn(`No VTT thumbnail source found for ${playbackId}`);
      return null;
    }

    // Fetch the VTT file content
    const vttResponse = await fetch(vttSource.url);
    if (!vttResponse.ok) {
      logger.warn(`Failed to fetch VTT file for ${playbackId}:`, vttResponse.status);
      return null;
    }

    const vttContent = await vttResponse.text();
    
    // Parse VTT content to extract keyframes
    const keyframes = parseVTTContent(vttContent);
    
    if (keyframes.length === 0) {
      logger.warn(`No keyframes found in VTT for ${playbackId}`);
      return null;
    }

    // Construct the base URL for thumbnails
    const baseUrl = vttSource.url.replace('/thumbnails.vtt', '');
    
    // Return the first thumbnail (keyframes_0.jpg)
    const firstKeyframe = keyframes[0];
    const thumbnailUrl = `${baseUrl}/${firstKeyframe.filename}`;

    return {
      thumbnailUrl,
      vttUrl: vttSource.url,
      keyframes
    };

  } catch (error) {
    logger.error(`Error fetching thumbnail info for ${playbackId}:`, error);
    return null;
  }
}

/**
 * Parses VTT content to extract keyframe information
 * @param vttContent - The VTT file content
 * @returns Array of keyframe objects
 */
function parseVTTContent(vttContent: string): Array<{ time: string; filename: string }> {
  const keyframes: Array<{ time: string; filename: string }> = [];
  const lines = vttContent.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Look for timestamp lines (format: 00:00:00.000 --> 00:00:10.000)
    if (line.includes('-->')) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && nextLine.endsWith('.jpg')) {
        keyframes.push({
          time: line.split('-->')[0].trim(),
          filename: nextLine
        });
        i += 2; // Skip the filename line
        continue;
      }
    }
    i++;
  }
  
  return keyframes;
}

/**
 * Gets a thumbnail URL for a specific time in the video
 * @param playbackId - The Livepeer playback ID
 * @param timeSeconds - Time in seconds (default: 0 for first frame)
 * @returns Promise<string | null>
 */
export async function getThumbnailUrl(playbackId: string, timeSeconds: number = 0): Promise<string | null> {
  try {
    const thumbnailInfo = await getThumbnailInfo(playbackId);
    if (!thumbnailInfo) return null;

    // Find the appropriate keyframe based on time
    const targetKeyframe = thumbnailInfo.keyframes.find(keyframe => {
      const keyframeTime = parseVTTTime(keyframe.time);
      return keyframeTime <= timeSeconds;
    }) || thumbnailInfo.keyframes[0]; // Fallback to first frame

    // Construct the thumbnail URL
    const baseUrl = thumbnailInfo.vttUrl.replace('/thumbnails.vtt', '');
    return `${baseUrl}/${targetKeyframe.filename}`;

  } catch (error) {
    logger.error(`Error getting thumbnail URL for ${playbackId}:`, error);
    return null;
  }
}

/**
 * Parses VTT time format (HH:MM:SS.mmm) to seconds
 * @param timeString - VTT time string
 * @returns Time in seconds
 */
function parseVTTTime(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(':').map(parseFloat);
  return hours * 3600 + minutes * 60 + seconds;
}
