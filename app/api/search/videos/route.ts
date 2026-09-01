import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { supabaseService } from "@/lib/sdk/supabase/service";

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

  if (!supabaseService) {
    return NextResponse.json({ results: [] });
  }

  const { data, error } = await supabaseService.rpc("autocomplete_video_assets", {
    search_query: q,
    result_limit: limit,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = (data ?? []).map(
    (row: { id: number; title: string | null; thumbnail_url: string | null }) => ({
      id: String(row.id),
      title: row.title ?? "Untitled",
      thumbnailUrl: row.thumbnail_url ?? undefined,
      href: `/discover/${row.id}`,
    })
  );

  return NextResponse.json({ results });
}
