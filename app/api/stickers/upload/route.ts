import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { groveService } from "@/lib/sdk/grove/service";
import { insertCampaignSticker } from "@/lib/sdk/supabase/campaign-stickers";
import { serverLogger } from "@/lib/utils/logger";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";

/**
 * POST /api/stickers/upload
 * multipart/form-data: file, name?, description?, proposalId?, brandAddress?, tokenId?
 *
 * Requires wallet auth matching brandAddress.
 * Always uploads artwork + metadata to Grove.
 * When tokenId + proposalId + brandAddress are present, also records in Supabase.
 */
export async function POST(req: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const name = String(form.get("name") ?? "Campaign Sticker");
    const description = String(form.get("description") ?? "");
    const proposalId = String(form.get("proposalId") ?? "").trim();
    const brandAddress = String(form.get("brandAddress") ?? "").trim();
    const tokenIdRaw = String(form.get("tokenId") ?? "").trim();

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!brandAddress || !isAddress(brandAddress)) {
      return NextResponse.json(
        { error: "valid brandAddress is required" },
        { status: 400 }
      );
    }

    try {
      await requireWalletAuthFor(req, brandAddress);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { error: authErr.message },
          { status: authErr.status }
        );
      }
      throw authErr;
    }

    const artwork = new File(
      [file],
      file instanceof File && file.name ? file.name : `${name}-sticker`,
      { type: file.type || "application/octet-stream" }
    );
    const imageUpload = await groveService.uploadFile(artwork);
    if (!imageUpload.success || !imageUpload.url) {
      return NextResponse.json(
        { error: imageUpload.error || "Image upload failed" },
        { status: 502 }
      );
    }

    const imageUri = imageUpload.url;
    const metadata = {
      name,
      description,
      image: imageUri,
      external_url: proposalId
        ? `https://snapshot.org/#/proposal/${proposalId}`
        : undefined,
      attributes: [
        ...(proposalId
          ? [{ trait_type: "proposalId", value: proposalId }]
          : []),
        { trait_type: "brand", value: brandAddress.toLowerCase() },
      ],
    };

    const metaUpload = await groveService.uploadJson(metadata);
    if (!metaUpload.success || !metaUpload.url) {
      return NextResponse.json(
        { error: metaUpload.error || "Metadata upload failed" },
        { status: 502 }
      );
    }

    const metadataUri = metaUpload.url;

    let sticker = null;
    if (
      tokenIdRaw &&
      !Number.isNaN(Number(tokenIdRaw)) &&
      proposalId
    ) {
      sticker = await insertCampaignSticker({
        tokenId: Number(tokenIdRaw),
        proposalId,
        ipfsHash: metadataUri,
        brandAddress,
        name,
        imageUri,
        metadata,
      });
    }

    return NextResponse.json({
      success: true,
      metadataUri,
      imageUri,
      sticker,
    });
  } catch (error) {
    serverLogger.error("sticker upload failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload sticker",
      },
      { status: 500 }
    );
  }
}
