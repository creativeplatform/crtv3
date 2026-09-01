import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { fetchPrecogMarket } from "@/lib/predictions/precog-markets";

export async function GET(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  const chainIdStr = request.nextUrl.searchParams.get("chainId");
  const marketIdStr = request.nextUrl.searchParams.get("marketId");

  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : NaN;
  const marketId = marketIdStr ? parseInt(marketIdStr, 10) : NaN;

  if (
    !Number.isInteger(chainId) ||
    chainId <= 0 ||
    !Number.isInteger(marketId) ||
    marketId <= 0
  ) {
    return NextResponse.json(
      { error: "Valid positive integer chainId and marketId are required" },
      { status: 400 }
    );
  }

  const data = await fetchPrecogMarket(chainId, marketId);
  if (!data) {
    return NextResponse.json({ market: null });
  }

  return NextResponse.json({ market: data });
}
