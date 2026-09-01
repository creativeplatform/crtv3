import { NextRequest, NextResponse } from "next/server";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { serverLogger } from "@/lib/utils/logger";

/**
 * GET /api/story/wip-price
 * Returns the current WIP (Wrapped IP) price in USD, used to show creators the
 * USD equivalent of their Story Protocol license minting fee.
 *
 * Sourced from CoinGecko's free public endpoint (no API key required) and
 * cached in-memory for 60s to stay within rate limits.
 */

const COINGECKO_WIP_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=wrapped-ip&vs_currencies=usd";

// Fallback used only when the price source is unreachable, so the UI can still
// render a rough estimate rather than nothing.
const FALLBACK_WIP_USD = 0.21;

let cachedPrice: number | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function GET(request: NextRequest) {
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  const now = Date.now();
  if (cachedPrice !== null && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, price: cachedPrice, cached: true });
  }

  try {
    const res = await fetch(COINGECKO_WIP_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`CoinGecko responded ${res.status}`);
    }

    const data = (await res.json()) as { "wrapped-ip"?: { usd?: number } };
    const price = data["wrapped-ip"]?.usd;

    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      throw new Error("No valid WIP price in response");
    }

    cachedPrice = price;
    cachedAt = now;
    return NextResponse.json({ success: true, price, cached: false });
  } catch (error) {
    serverLogger.error("Failed to fetch WIP price:", error);

    // Serve a stale cache or fallback so the UI degrades gracefully.
    const price = cachedPrice ?? FALLBACK_WIP_USD;
    return NextResponse.json({
      success: true,
      price,
      cached: true,
      stale: true,
    });
  }
}
