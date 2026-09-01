import { supabaseService } from "@/lib/sdk/supabase/service";

/**
 * Summary of a prediction market linked to a video, for video-page strips.
 */
export type VideoPredictionSummary = {
  questionId: string;
  title: string | null;
  category: string | null;
  questionType: string | null;
  outcomes: string[] | null;
  createdAt: string | null;
};

export type VideoPredictionLinksResult =
  | { ok: true; predictions: VideoPredictionSummary[] }
  | { ok: false; status: number; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVideoAssetUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

const LINKS_LIMIT = 50;

/**
 * Resolve the prediction markets linked to a video (Livepeer asset UUID).
 *
 * Shared by GET /api/predictions/by-video and the server-side
 * ActivePredictionsStripServer. The SSR component must NOT self-fetch the
 * API route over HTTP — the route is behind BotID deep analysis (Kasada),
 * which 403s server-to-server requests that carry no browser headers.
 */
export async function getVideoPredictionLinks(
  rawVideoAssetId: string,
): Promise<VideoPredictionLinksResult> {
  const raw = rawVideoAssetId.trim();
  // Accept the Livepeer asset UUID used by /discover/[id] pages.
  if (!isVideoAssetUuid(raw)) {
    return {
      ok: false,
      status: 400,
      error:
        "Valid videoAssetId (Livepeer asset UUID) query parameter is required",
    };
  }
  const videoAssetId = raw.toLowerCase();

  if (!supabaseService) {
    return { ok: true, predictions: [] };
  }

  // Resolve Livepeer UUID -> internal video_assets PK.
  const { data: videoRow, error: videoLookupError } = await supabaseService
    .from("video_assets")
    .select("id")
    .eq("asset_id", videoAssetId)
    .maybeSingle();

  if (videoLookupError) {
    return { ok: false, status: 500, error: videoLookupError.message };
  }

  if (!videoRow) {
    return { ok: true, predictions: [] };
  }

  const { data: links, error: linksError } = await supabaseService
    .from("prediction_video_links")
    .select("question_id, created_at")
    .eq("video_asset_id", videoRow.id)
    .order("created_at", { ascending: false })
    .limit(LINKS_LIMIT);

  if (linksError) {
    return { ok: false, status: 500, error: linksError.message };
  }

  if (!links || links.length === 0) {
    return { ok: true, predictions: [] };
  }

  const questionIds = links.map((l) => l.question_id);
  const createdAtByQuestion = new Map(
    links.map((l) => [l.question_id, l.created_at] as const),
  );

  // Best-effort display metadata for cards before subgraph hydration.
  const { data: metadataRows, error: metadataError } = await supabaseService
    .from("prediction_market_creations")
    .select("question_id, title, category, question_type, outcomes")
    .in("question_id", questionIds);

  if (metadataError) {
    // Metadata is optional enrichment; surface the IDs even if this leg fails.
    return {
      ok: true,
      predictions: links.map((l) => ({
        questionId: l.question_id,
        title: null,
        category: null,
        questionType: null,
        outcomes: null,
        createdAt: l.created_at,
      })),
    };
  }

  const metadataByQuestion = new Map(
    (metadataRows ?? []).map((row) => [row.question_id, row] as const),
  );

  const predictions: VideoPredictionSummary[] = questionIds.map((questionId) => {
    const meta = metadataByQuestion.get(questionId);
    return {
      questionId,
      title: meta?.title ?? null,
      category: meta?.category ?? null,
      questionType: meta?.question_type ?? null,
      outcomes: Array.isArray(meta?.outcomes)
        ? (meta!.outcomes as string[])
        : null,
      createdAt: createdAtByQuestion.get(questionId) ?? null,
    };
  });

  return { ok: true, predictions };
}