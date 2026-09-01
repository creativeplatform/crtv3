import { NextRequest, NextResponse } from "next/server";
import { listCampaignStickers } from "@/lib/sdk/supabase/campaign-stickers";
import { serverLogger } from "@/lib/utils/logger";
import { rateLimiters } from "@/lib/middleware/rateLimit";

/** GET /api/stickers/list — public sticker registry for inventory UI */
export async function GET(req: NextRequest) {
  const rl = await rateLimiters.generous(req);
  if (rl) return rl;

  try {
    const stickers = await listCampaignStickers(200);
    return NextResponse.json({ stickers });
  } catch (error) {
    serverLogger.error("list stickers failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list stickers",
      },
      { status: 500 }
    );
  }
}
