/**
 * GET /api/story/license-terms
 *
 * Fetch Story Protocol license terms for a video.
 * Public read endpoint — no auth required (audit/view data).
 *
 * Query params (one of):
 *   - videoAssetId: numeric video_assets.id → looks up story_ip_id + story_license_terms_id from DB
 *   - ipId + licenseTermsId: direct Story Protocol IDs
 *
 * Returns license terms details from the Story SDK.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVideoAssetById } from "@/services/video-assets";
import { createStoryClient } from "@/lib/sdk/story/client";
import { serverLogger } from "@/lib/utils/logger";
import { rateLimiters } from "@/lib/middleware/rateLimit";

export async function GET(request: NextRequest) {
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(request.url);
    const videoAssetId = searchParams.get("videoAssetId");
    const ipId = searchParams.get("ipId");
    const licenseTermsId = searchParams.get("licenseTermsId");

    let resolvedIpId = ipId;
    let resolvedLicenseTermsId = licenseTermsId;

    // If videoAssetId is provided, look up from DB
    if (videoAssetId) {
      const assetId = parseInt(videoAssetId, 10);
      if (isNaN(assetId)) {
        return NextResponse.json(
          { error: "Invalid videoAssetId" },
          { status: 400 }
        );
      }

      const videoAsset = await getVideoAssetById(assetId);
      if (!videoAsset) {
        return NextResponse.json(
          { error: "Video asset not found" },
          { status: 404 }
        );
      }

      resolvedIpId = videoAsset.story_ip_id || resolvedIpId;
      resolvedLicenseTermsId =
        videoAsset.story_license_terms_id || resolvedLicenseTermsId;

      if (!resolvedIpId) {
        return NextResponse.json(
          {
            registered: videoAsset.story_ip_registered,
            error: "Video is not registered as IP on Story Protocol",
          },
          { status: 404 }
        );
      }

      if (!resolvedLicenseTermsId) {
        return NextResponse.json({
          ipId: resolvedIpId,
          licenseTermsId: null,
          terms: null,
          message: "No license terms attached to this IP asset",
        });
      }
    }

    if (!resolvedIpId || !resolvedLicenseTermsId) {
      return NextResponse.json(
        { error: "Missing required params: provide videoAssetId, or both ipId and licenseTermsId" },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(resolvedLicenseTermsId)) {
      return NextResponse.json(
        { error: "Invalid licenseTermsId format. Must be a numeric string." },
        { status: 400 }
      );
    }

    // Fetch license terms from Story Protocol
    const privateKey = process.env.STORY_PROTOCOL_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: "Story Protocol not configured", hint: "STORY_PROTOCOL_PRIVATE_KEY required" },
        { status: 503 }
      );
    }

    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const client = createStoryClient(account.address, privateKey);

    try {
      const response = await client.license.getLicenseTerms(
        BigInt(resolvedLicenseTermsId)
      );

      const terms = response.terms;

      return NextResponse.json({
        ipId: resolvedIpId,
        licenseTermsId: resolvedLicenseTermsId,
        terms: {
          transferable: terms.transferable,
          commercialUse: terms.commercialUse,
          commercialAttribution: terms.commercialAttribution,
          commercialRevShare: String(terms.commercialRevShare),
          commercialRevCeiling: terms.commercialRevCeiling?.toString(),
          derivativesAllowed: terms.derivativesAllowed,
          derivativesAttribution: terms.derivativesAttribution,
          derivativesReciprocal: terms.derivativesReciprocal,
          defaultMintingFee: terms.defaultMintingFee?.toString(),
          currency: terms.currency,
          expiration: terms.expiration?.toString(),
          uri: terms.uri,
        },
      });
    } catch (err) {
      serverLogger.error("Failed to fetch license terms from Story SDK:", err);
      return NextResponse.json(
        {
          ipId: resolvedIpId,
          licenseTermsId: resolvedLicenseTermsId,
          terms: null,
          error: "Failed to fetch license terms from Story Protocol",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    serverLogger.error("License terms lookup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch license terms" },
      { status: 500 }
    );
  }
}