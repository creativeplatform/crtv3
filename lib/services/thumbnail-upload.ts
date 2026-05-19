import { groveService } from '@/lib/sdk/grove/service';
import { uploadFileToGrove } from '@/lib/sdk/orb/grove-upload';
import { serverLogger } from '@/lib/utils/logger';

export interface ThumbnailUploadOptions {
  /** Lens account address for Orb Grove upload plugin (browser only). */
  groveAccount?: string;
  onProgress?: (progress: number) => void;
}


export interface ThumbnailUploadResult {
  success: boolean;
  thumbnailUrl?: string; // This will trigger the GatewayImage component which handles IPFS/Arweave/HTTP
  error?: string;
}

/**
 * Uploads a thumbnail image file using Grove (Lens Storage):
 * - Grove (Primary) - Decentralized storage with instant gateway
 * 
 * @param file - The image file to upload
 * @param playbackId - The video's playback ID (unused for upload but kept for signature)
 * @returns Promise<ThumbnailUploadResult>
 */
export async function uploadThumbnailToIPFS(
  file: File,
  playbackId: string,
  options?: ThumbnailUploadOptions,
): Promise<ThumbnailUploadResult> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'File must be an image'
      };
    }

    serverLogger.debug('[ThumbnailUpload] Starting upload with Grove...');

    if (typeof window !== 'undefined' && options?.groveAccount) {
      try {
        const orbResult = await uploadFileToGrove({
          file,
          account: options.groveAccount,
          onProgress: options.onProgress,
        });
        return {
          success: true,
          thumbnailUrl: orbResult.gatewayUrl,
        };
      } catch (orbErr) {
        serverLogger.warn(
          '[ThumbnailUpload] Orb Grove upload failed, falling back:',
          orbErr,
        );
      }
    }

    const result = await groveService.uploadFile(file);

    if (!result.success || !result.url) {
      return {
        success: false,
        error: result.error || 'Upload failed'
      };
    }

    serverLogger.debug('[ThumbnailUpload] ✅ Thumbnail upload successful via Grove:', result.hash);
    serverLogger.debug('[ThumbnailUpload] 📍 Accessible via:', result.url);

    // Return the URL directly (Grove gateway URL)
    // The existing app handles ipfs:// but generic URLs are better supported
    return {
      success: true,
      thumbnailUrl: result.url
    };

  } catch (error) {
    serverLogger.error('[ThumbnailUpload] ❌ Error uploading thumbnail to Grove:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Converts a blob URL to a File object for uploading
 * @param blobUrl - The blob URL to convert
 * @param filename - The filename for the file
 * @returns Promise<File | null>
 */
export async function blobUrlToFile(blobUrl: string, filename: string): Promise<File | null> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();

    // Create a File object from the blob
    const file = new File([blob], filename, { type: blob.type });
    return file;
  } catch (error) {
    serverLogger.error('Error converting blob URL to file:', error);
    return null;
  }
}

/**
 * Uploads a thumbnail from a blob URL to Grove
 * 
 * @param blobUrl - The blob URL of the thumbnail
 * @param playbackId - The video's playback ID for naming
 * @returns Promise<ThumbnailUploadResult>
 */
export async function uploadThumbnailFromBlob(
  blobUrl: string,
  playbackId: string
): Promise<ThumbnailUploadResult> {
  try {
    // Convert blob URL to file
    const file = await blobUrlToFile(blobUrl, `thumbnail-${playbackId}.jpg`);

    if (!file) {
      return {
        success: false,
        error: 'Failed to convert blob URL to file'
      };
    }

    // Upload to Grove
    return await uploadThumbnailToIPFS(file, playbackId);

  } catch (error) {
    serverLogger.error('[ThumbnailUpload] ❌ Error uploading thumbnail from blob:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
