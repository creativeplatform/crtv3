import { NextRequest, NextResponse } from "next/server";
import { getStickerByProposal } from "@/lib/sdk/supabase/campaign-stickers";
import { serverLogger } from "@/lib/utils/logger";
import { rateLimiters } from "@/lib/middleware/rateLimit";

type RouteContext = {
  params: Promise<{ proposalId: string }>;
};

/**
 * GET /api/stickers/by-proposal/[proposalId]
 * Public preview of campaign sticker artwork for a Snapshot proposal.
 * No wallet auth — used so voters can see the NFT before / while voting.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const rl = await rateLimiters.generous(req);
  if (rl) return rl;

  try {
    const { proposalId: raw } = await context.params;
    const proposalId = decodeURIComponent(raw ?? "").trim();
    if (!proposalId) {
      return NextResponse.json({ error: "proposalId is required" }, { status: 400 });
    }

    const sticker = await getStickerByProposal(proposalId);
    if (!sticker) {
      return NextResponse.json(
        { error: "No sticker registered for this proposal" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      tokenId: sticker.token_id,
      name: sticker.name,
      imageUri: sticker.image_uri,
      ipfsHash: sticker.ipfs_hash,
      proposalId: sticker.proposal_id,
    });
  } catch (error) {
    serverLogger.error("sticker by-proposal preview failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load sticker preview",
      },
      { status: 500 }
    );
  }
}
