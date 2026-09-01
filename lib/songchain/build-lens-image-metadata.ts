import {
  image,
  MediaImageMimeType,
  MetadataLicenseType,
} from "@lens-protocol/metadata";

export type SongchainAttachedImage = {
  /** Grove gateway URL from uploadToGrove / groveService.uploadFile */
  url: string;
  mimeType: string;
};

const MIME_TO_LENS: Record<string, MediaImageMimeType> = {
  "image/jpeg": MediaImageMimeType.JPEG,
  "image/jpg": MediaImageMimeType.JPEG,
  "image/png": MediaImageMimeType.PNG,
  "image/gif": MediaImageMimeType.GIF,
  "image/webp": MediaImageMimeType.WEBP,
};

export function resolveMediaImageMimeType(
  mimeType: string,
): MediaImageMimeType | null {
  const normalized = mimeType.trim().toLowerCase();
  return MIME_TO_LENS[normalized] ?? null;
}

export function buildLensImageMetadata(
  attached: SongchainAttachedImage,
  caption: string,
) {
  const type = resolveMediaImageMimeType(attached.mimeType);
  if (!type) {
    throw new Error(
      `Unsupported image type: ${attached.mimeType}. Use JPEG, PNG, GIF, or WebP.`,
    );
  }

  const groveUrl = attached.url.trim();
  if (!groveUrl) {
    throw new Error("Image Grove URL is missing.");
  }

  const trimmedCaption = caption.trim();

  return image({
    ...(trimmedCaption ? { content: trimmedCaption } : {}),
    image: {
      item: groveUrl,
      type,
      license: MetadataLicenseType.CCO,
    },
    locale: "en",
  });
}
