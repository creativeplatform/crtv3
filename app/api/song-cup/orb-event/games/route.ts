import { NextRequest, NextResponse } from "next/server";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { serverLogger } from "@/lib/utils/logger";
import { fetchOrbEventGames } from "@/lib/sdk/orb/event-games";

export const runtime = "nodejs";

/** Same-origin proxy for Orb event games (avoids browser CORS to orbapi.xyz). */
export async function GET(request: NextRequest) {
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  try {
    const data = await fetchOrbEventGames(accessToken);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    serverLogger.error("[song-cup/orb-event/games] fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to load event games" },
      { status: 502 },
    );
  }
}
