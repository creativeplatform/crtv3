/**
 * Mint a viewer-created clip as a Story Protocol derivative IP of the parent livestream.
 * The viewer (clipper) owns the resulting NFT; the broadcaster receives royalties
 * via the parent's attached PIL license terms.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { createStoryClient } from "@/lib/sdk/story/client";
import { getOrCreateCreatorCollection } from "@/lib/sdk/story/collection-service";
import { mintAndRegisterDerivative } from "@/lib/sdk/story/spg-service";
import { getVideoAssetById, updateVideoAsset } from "@/services/video-assets";
import { getStreamByPlaybackId } from "@/services/streams";
import { groveService } from "@/lib/sdk/grove/service";
import type { Address } from "viem";
import { serverLogger } from "@/lib/utils/logger";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.strict(request);
  if (rl) return rl;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { clipVideoAssetId, recipient } = body ?? {};
  if (!clipVideoAssetId || !recipient) {
    return NextResponse.json(
      { error: "Missing required fields", hint: "clipVideoAssetId, recipient are required" },
      { status: 400 }
    );
  }
  if (!ADDRESS_REGEX.test(recipient)) {
    return NextResponse.json({ error: "Invalid recipient format" }, { status: 400 });
  }

  const clip = await getVideoAssetById(Number(clipVideoAssetId));
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }
  if (clip.source_type !== "Clip") {
    return NextResponse.json({ error: "Video asset is not a clip" }, { status: 400 });
  }
  if (clip.is_minted) {
    return NextResponse.json({ error: "Clip is already minted" }, { status: 409 });
  }
  if (
    clip.clipper_address &&
    clip.clipper_address.toLowerCase() !== recipient.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Only the clipper can mint their own clip" },
      { status: 403 }
    );
  }

  const parentStoryIpId = clip.parent_story_ip_id;
  const parentPlaybackId = clip.parent_playback_id;
  if (!parentStoryIpId || !parentPlaybackId) {
    return NextResponse.json(
      {
        error: "Parent stream is not registered as Story IP",
        hint: "The broadcaster must register this stream as IP before derivative clips can be minted.",
      },
      { status: 400 }
    );
  }

  const parentStream = await getStreamByPlaybackId(parentPlaybackId);
  const parentLicenseTermsId =
    parentStream?.story_license_terms_id ?? clip.story_license_terms_id ?? null;
  if (!parentLicenseTermsId) {
    return NextResponse.json(
      {
        error: "Parent stream has no license terms attached",
        hint: "The broadcaster must attach PIL license terms to the stream before derivative clips can be minted.",
      },
      { status: 400 }
    );
  }

  const privateKey = process.env.STORY_PROTOCOL_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { error: "Story Protocol not configured", hint: "STORY_PROTOCOL_PRIVATE_KEY required" },
      { status: 500 }
    );
  }

  try {
    const { privateKeyToAccount } = await import("viem/accounts");
    const fundingAddress = privateKeyToAccount(privateKey as `0x${string}`).address as Address;

    const clipPlaybackUrl = clip.playback_id
      ? `https://lvpr.tv/?v=${clip.playback_id}`
      : null;

    const metadata = {
      name: clip.title || `Clip of ${parentPlaybackId.slice(0, 8)}`,
      description:
        clip.description ||
        `Viewer-created clip from livestream ${parentPlaybackId} (${clip.clip_start_ms}–${clip.clip_end_ms} ms).`,
      image: clip.thumbnail_url || undefined,
      animation_url: clipPlaybackUrl || undefined,
      attributes: [
        { trait_type: "source_type", value: "Clip" },
        { trait_type: "parent_playback_id", value: parentPlaybackId },
        { trait_type: "parent_ip_id", value: parentStoryIpId },
        { trait_type: "clip_start_ms", value: clip.clip_start_ms },
        { trait_type: "clip_end_ms", value: clip.clip_end_ms },
        { trait_type: "clipper", value: clip.clipper_address || recipient },
      ],
    };

    const metadataUpload = await groveService.uploadJson(metadata);
    if (!metadataUpload.success || !metadataUpload.url) {
      return NextResponse.json(
        { error: metadataUpload.error || "Failed to upload clip metadata" },
        { status: 502 }
      );
    }

    const client = createStoryClient(fundingAddress, privateKey);
    const clipperAddress = (clip.clipper_address || recipient) as Address;
    const collectionAddress = await getOrCreateCreatorCollection(
      client,
      clipperAddress,
      "CRTV Clips",
      "CLIP"
    );

    const result = await mintAndRegisterDerivative(client, {
      collectionAddress,
      recipient: recipient as Address,
      parentIpIds: [parentStoryIpId as Address],
      licenseTermsIds: [parentLicenseTermsId],
      metadataURI: metadataUpload.url,
      allowDuplicates: true,
    });

    await updateVideoAsset(clip.id, {
      token_id: result.tokenId,
      contract_address: collectionAddress,
      story_ip_registered: true,
      story_ip_id: result.ipId,
      story_ip_registration_tx: result.txHash,
      story_ip_registered_at: new Date(),
      story_license_terms_id: parentLicenseTermsId,
      metadata_uri: metadataUpload.url,
      status: "minted",
    });

    return NextResponse.json({
      success: true,
      ipId: result.ipId,
      tokenId: result.tokenId,
      txHash: result.txHash,
      collectionAddress,
      metadataURI: metadataUpload.url,
    });
  } catch (error) {
    serverLogger.error("Clip derivative mint failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to mint clip as derivative",
      },
      { status: 500 }
    );
  }
}
