import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { supabaseService } from "@/lib/sdk/supabase/service";

export async function GET(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  const questionId = request.nextUrl.searchParams.get("questionId")?.trim();
  if (!questionId || !/^0x[a-fA-F0-9]{64}$/.test(questionId)) {
    return NextResponse.json(
      { error: "Valid questionId query parameter is required" },
      { status: 400 }
    );
  }

  if (!supabaseService) {
    return NextResponse.json({ metadata: null });
  }

  const { data, error } = await supabaseService
    .from("prediction_market_creations")
    .select("title, category, question_type, outcomes")
    .eq("question_id", questionId.toLowerCase())
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ metadata: null });
  }

  return NextResponse.json({
    metadata: {
      title: data.title ?? null,
      category: data.category ?? null,
      questionType: data.question_type ?? null,
      outcomes: Array.isArray(data.outcomes)
        ? (data.outcomes as string[])
        : null,
    },
  });
}
