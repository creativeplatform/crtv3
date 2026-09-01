import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { meTokenSupabaseService } from "@/lib/sdk/supabase/metokens";

import { sanitizeAutocompleteQuery } from "@/lib/search/sanitize-autocomplete-query";

export async function GET(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  const q = sanitizeAutocompleteQuery(
    request.nextUrl.searchParams.get("q") ?? ""
  );
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") || "8", 10) || 8,
    20
  );

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const tokens = await meTokenSupabaseService.searchMeTokens(q, limit);
    const results = tokens.map((t) => ({
      address: t.address,
      name: t.name ?? t.symbol ?? "Token",
      symbol: t.symbol ?? "",
      type: "metoken" as const,
      href: `/market?search=${encodeURIComponent(t.symbol ?? t.name ?? "")}`,
    }));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 500 }
    );
  }
}
