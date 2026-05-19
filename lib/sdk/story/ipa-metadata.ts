/**
 * Story Protocol IPA (IP Asset) Metadata Standard
 * Builds metadata that satisfies Story's IPA Metadata Standard and attestation requirements.
 * @see https://docs.story.foundation/concepts/ip-asset/ipa-metadata-standard.md
 */

import { ipfsService } from "@/lib/sdk/ipfs/service";
import type { VideoAsset } from "@/lib/types/video-asset";
import { createHash } from "crypto";

/** IPA-standard metadata fields for Story attestation (mediaUrl, mediaHash, mediaType required for infringement checks). */
export interface IPAMetadataStandard {
  name?: string;
  title?: string;
  description?: string;
  image?: string;
  /** Canonical URL for the media (video playback or asset). Enables attestation when set. */
  mediaUrl?: string;
  /** SHA-256 hash of the media (hex). Enables attestation when set with mediaUrl and mediaType. */
  mediaHash?: string;
  /** MIME type of the media, e.g. "video/mp4". */
  mediaType?: string;
  /** Creators (e.g. [{ address, name? }]). */
  creators?: Array<{ address?: string; name?: string }>;
  /** Canonical source video URL (e.g. app watch page). */
  sourceVideoUrl?: string;
  [key: string]: unknown;
}

export interface UploadIpaMetadataResult {
  ipMetadataURI: string;
  ipMetadataHash?: string;
}

/** Build canonical source video URL for IP metadata. */
function getSourceVideoUrl(
  videoAsset: { playback_id?: string },
  baseUrl?: string
): string {
  const base =
    baseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const playbackId = videoAsset.playback_id ?? "";
  return playbackId ? `${base.replace(/\/$/, "")}/watch/${playbackId}` : "";
}

/**
 * Build IPA-standard metadata JSON from a video asset.
 * Includes mediaUrl, mediaType, and optional mediaHash so Story attestation can run for commercial IP.
 */
export function buildIpaMetadataFromVideoAsset(
  videoAsset: VideoAsset,
  options: {
    /** Override source video URL (default: app watch URL). */
    sourceVideoUrl?: string;
    /** SHA-256 of the media (hex) if available; enables attestation. */
    mediaHash?: string;
    /** Creator wallet address for creators[].address. */
    creatorAddress?: string;
    /** Creator display name for creators[].name. */
    creatorName?: string;
  } = {}
): IPAMetadataStandard {
  const sourceVideoUrl =
    options.sourceVideoUrl ?? getSourceVideoUrl(videoAsset);

  const creators: Array<{ address?: string; name?: string }> = [];
  if (options.creatorAddress) {
    creators.push({
      address: options.creatorAddress,
      name: options.creatorName,
    });
  } else if (videoAsset.creator_id) {
    // creator_id may be UUID or address; if it looks like address, use it
    const id = String(videoAsset.creator_id);
    if (id.startsWith("0x") && id.length === 42) {
      creators.push({ address: id });
    }
  }

  return {
    name: videoAsset.title,
    title: videoAsset.title,
    description: videoAsset.description ?? undefined,
    image: videoAsset.thumbnailUri || undefined,
    mediaUrl: sourceVideoUrl || undefined,
    mediaHash: options.mediaHash,
    mediaType: "video/mp4",
    creators: creators.length ? creators : undefined,
    sourceVideoUrl: sourceVideoUrl || undefined,
  };
}

/**
 * Upload IPA-standard metadata JSON to IPFS and return the URI (and optional content hash).
 * Use the returned ipMetadataURI as ipMetadataURI when registering or minting IP.
 */
export async function uploadIpaMetadataToIpfs(
  metadata: IPAMetadataStandard
): Promise<UploadIpaMetadataResult> {
  const jsonString = JSON.stringify(metadata);
  const blob = new Blob([jsonString], { type: "application/json" });
  const result = await ipfsService.uploadFile(blob);

  if (!result.success || (!result.hash && !result.url)) {
    throw new Error(
      result.error ?? "Failed to upload IPA metadata to IPFS"
    );
  }

  const ipMetadataURI =
    result.url &&
    (result.url.startsWith("http://") ||
      result.url.startsWith("https://") ||
      result.url.startsWith("ipfs://"))
      ? result.url
      : `ipfs://${result.hash}`;
  const ipMetadataHash = `0x${createHash("sha256").update(jsonString).digest("hex")}`;

  return {
    ipMetadataURI,
    ipMetadataHash,
  };
}

/**
 * Build IPA metadata from a video asset and upload to IPFS.
 * Convenience helper for registration and mint flows.
 */
export async function buildAndUploadIpaMetadata(
  videoAsset: VideoAsset,
  options: {
    sourceVideoUrl?: string;
    mediaHash?: string;
    creatorAddress?: string;
    creatorName?: string;
  } = {}
): Promise<UploadIpaMetadataResult> {
  const metadata = buildIpaMetadataFromVideoAsset(videoAsset, options);
  return uploadIpaMetadataToIpfs(metadata);
}
