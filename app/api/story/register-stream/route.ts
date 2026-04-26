/**
 * Register a broadcaster's livestream as a Story Protocol IP Asset and
 * attach PIL commercial-remix terms so that viewer-created clip NFTs can be
 * minted as derivative IPs with automatic royalty routing to the broadcaster.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { PILFlavor } from "@story-protocol/core-sdk";
import { parseEther, type Address } from "viem";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { createStoryClient } from "@/lib/sdk/story/client";
import { getOrCreateCreatorCollection } from "@/lib/sdk/story/collection-service";
import { mintAndRegisterIpAndAttachPilTerms } from "@/lib/sdk/story/spg-service";
import { getStreamByCreator, updateStreamStoryIp } from "@/services/streams";
import { groveService } from "@/lib/sdk/grove/service";
import { WIP_TOKEN_ADDRESS } from "@/lib/sdk/story/constants";
import { serverLogger } from "@/lib/utils/logger";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_REV_SHARE = 10;

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

  const { creatorAddress, commercialRevShare, streamName, thumbnailUrl } = body ?? {};
  if (!creatorAddress) {
    return NextResponse.json({ error: "Missing creatorAddress" }, { status: 400 });
  }
  if (!ADDRESS_REGEX.test(creatorAddress)) {
    return NextResponse.json({ error: "Invalid creatorAddress format" }, { status: 400 });
  }

  const revShare = commercialRevShare == null ? DEFAULT_REV_SHARE : Number(commercialRevShare);
  if (!Number.isFinite(revShare) || revShare < 0 || revShare > 100) {
    return NextResponse.json(
      { error: "commercialRevShare must be between 0 and 100" },
      { status: 400 }
    );
  }

  const stream = await getStreamByCreator(creatorAddress);
  if (!stream) {
    return NextResponse.json({ error: "Stream not found for creator" }, { status: 404 });
  }
  if (stream.story_ip_id) {
    return NextResponse.json(
      {
        error: "Stream is already registered as IP",
        ipId: stream.story_ip_id,
        licenseTermsId: stream.story_license_terms_id,
      },
      { status: 409 }
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

    const streamPlaybackUrl = `https://lvpr.tv/?v=${stream.playback_id}`;
    const resolvedName =
      (typeof streamName === "string" && streamName.trim()) ||
      stream.name ||
      `Livestream ${stream.playback_id.slice(0, 8)}`;

    const metadata = {
      name: resolvedName,
      description: `Livestream channel by creator ${creatorAddress}. Viewers can create and mint derivative clip NFTs.`,
      image: thumbnailUrl || stream.thumbnail_url || undefined,
      animation_url: streamPlaybackUrl,
      attributes: [
        { trait_type: "source_type", value: "Livestream" },
        { trait_type: "playback_id", value: stream.playback_id },
        { trait_type: "creator", value: creatorAddress },
        { trait_type: "commercial_rev_share", value: revShare },
      ],
    };

    const metadataUpload = await groveService.uploadJson(metadata);
    if (!metadataUpload.success || !metadataUpload.url) {
      return NextResponse.json(
        { error: metadataUpload.error || "Failed to upload stream metadata" },
        { status: 502 }
      );
    }

    const client = createStoryClient(fundingAddress, privateKey);
    const collectionAddress = await getOrCreateCreatorCollection(
      client,
      creatorAddress as Address,
      `${resolvedName} Streams`,
      "STREAM"
    );

    const result = await mintAndRegisterIpAndAttachPilTerms(client, {
      collectionAddress,
      recipient: creatorAddress as Address,
      metadataURI: metadataUpload.url,
      allowDuplicates: true,
      licenseTermsData: [
        {
          terms: PILFlavor.commercialRemix({
            commercialRevShare: revShare,
            defaultMintingFee: parseEther("0"),
            currency: WIP_TOKEN_ADDRESS,
          }),
        },
      ],
    });

    const licenseTermsId = result.licenseTermsIds?.[0] ?? null;

    await updateStreamStoryIp(creatorAddress, {
      story_ip_id: result.ipId,
      story_license_terms_id: licenseTermsId,
      story_ip_registration_tx: result.txHash,
      story_commercial_rev_share: revShare,
    });

    return NextResponse.json({
      success: true,
      ipId: result.ipId,
      tokenId: result.tokenId,
      licenseTermsId,
      txHash: result.txHash,
      collectionAddress,
      metadataURI: metadataUpload.url,
      commercialRevShare: revShare,
    });
  } catch (error) {
    serverLogger.error("Register stream as IP failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to register stream as IP",
      },
      { status: 500 }
    );
  }
}
