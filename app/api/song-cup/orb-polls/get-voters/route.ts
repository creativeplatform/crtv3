import { NextRequest, NextResponse } from "next/server";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { serverLogger } from "@/lib/utils/logger";
import { fetchOrbPollVoters } from "@/lib/sdk/orb/polls/client";

export const runtime = "nodejs";

/** Same-origin proxy for Orb Polls get-voters (avoids browser CORS to orbapi.xyz). */
export async function POST(request: NextRequest) {
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  let body: { id?: string; limit?: number };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid body");
    }
    body = parsed as { id?: string; limit?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pollPostId = body.id?.trim();
  if (!pollPostId) {
    return NextResponse.json({ error: "Poll post id is required" }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  try {
    const data = await fetchOrbPollVoters(pollPostId, accessToken, body.limit ?? 25);
    if (!data) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }
    return NextResponse.json({ status: "SUCCESS", data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    serverLogger.error("[song-cup/orb-polls/get-voters] fetch failed:", error);
    return NextResponse.json({ error: "Failed to load poll results" }, { status: 502 });
  }
}
