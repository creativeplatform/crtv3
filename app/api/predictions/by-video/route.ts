import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { getVideoPredictionLinks } from "@/lib/predictions/video-prediction-links";

/**
 * GET /api/predictions/by-video?videoAssetId=<Livepeer asset UUID>
 *
 * Returns the prediction markets linked to a video, newest first, for the
 * video-page ActivePredictionsStrip. Anonymous access is allowed (RLS is
 * public-read), so this only exposes question IDs plus any stored display
 * metadata (title/category/questionType/outcomes) from
 * prediction_market_creations — no addresses beyond the creator wallet, which
 * is public on-chain data anyway.
 *
 * Response:
 * {
 *   videoAssetId: "<normalized>",
 *   predictions: [
 *     { questionId, title, category, questionType, outcomes, createdAt }
 *   ]
 * }
 *
 * Server components must use getVideoPredictionLinks() directly instead of
 * calling this route over HTTP — BotID deep analysis 403s server-to-server
 * fetches. This route serves browser/client callers.
 */
export async function GET(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  const videoAssetId = request.nextUrl.searchParams.get("videoAssetId") ?? "";
  const result = await getVideoPredictionLinks(videoAssetId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    videoAssetId: videoAssetId.trim().toLowerCase(),
    predictions: result.predictions,
  });
}