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

  const { data, error } = await supabaseService.rpc(
    "autocomplete_prediction_creations",
    {
      search_query: q,
      result_limit: limit,
    }
  );

  if (error) {
    return NextResponse.json({ results: [] });
  }

  const results = (data ?? [])
    .filter((row: { question_id: string | null }) => row.question_id)
    .map(
      (row: {
        question_id: string;
        title: string | null;
        category: string | null;
      }) => ({
        questionId: row.question_id,
        title: row.title ?? "Prediction",
        category: row.category ?? undefined,
        href: `/predict/${row.question_id}`,
      })
    );

  return NextResponse.json({ results });
}
