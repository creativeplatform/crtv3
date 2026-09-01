import {
  parsePredictionDisplay,
  applyPredictionMetadataOverride,
  type PredictionMetadataInput,
  type ParsedPredictionDisplay,
} from "@/lib/predictions/parse-prediction-display";
import {
  parsePrecogReference,
  stripPrecogReference,
  fetchPrecogMarket,
  type PrecogMarketRef,
} from "@/lib/predictions/precog-markets";

export type PredictionMetadataOverride = {
  title?: string | null;
  questionType?: string | null;
  category?: string | null;
  outcomes?: string[] | null;
};

export type EnrichedPredictionDisplay = {
  parsed: ParsedPredictionDisplay;
  precogRef: PrecogMarketRef | null;
};

function parseSubgraphOutcomes(outcomesRaw: unknown): string[] {
  if (Array.isArray(outcomesRaw)) {
    return outcomesRaw.map(String).filter(Boolean);
  }
  if (typeof outcomesRaw === "string" && outcomesRaw.length > 0) {
    return outcomesRaw.split("\n").filter(Boolean);
  }
  return [];
}

function mergeOutcomes(
  parsed: ParsedPredictionDisplay,
  ...sources: (string[] | undefined)[]
): ParsedPredictionDisplay {
  for (const src of sources) {
    if (src && src.length > 0) {
      const type =
        parsed.type === "bool" && src.length > 2
          ? "single-select"
          : parsed.type;
      return { ...parsed, type, outcomes: src };
    }
  }
  return parsed;
}

/**
 * Synchronous enrichment from on-chain text + optional subgraph/metadata fields.
 */
export function enrichPredictionDisplaySync(
  questionText: string,
  templateId?: string | number | bigint | null,
  options?: {
    subgraphOutcomes?: unknown;
    subgraphCategory?: string | null;
    metadata?: PredictionMetadataOverride | PredictionMetadataInput | null;
  }
): EnrichedPredictionDisplay {
  let parsed = parsePredictionDisplay(questionText, templateId);
  const precogRef = parsePrecogReference(parsed.title);

  if (precogRef) {
    parsed = { ...parsed, title: stripPrecogReference(parsed.title) };
  }

  const subgraphOutcomes = parseSubgraphOutcomes(options?.subgraphOutcomes);
  if (options?.subgraphCategory?.trim()) {
    parsed = { ...parsed, category: options.subgraphCategory.trim() };
  }

  parsed = mergeOutcomes(parsed, subgraphOutcomes);
  parsed = applyPredictionMetadataOverride(parsed, options?.metadata ?? null);

  if (options?.metadata?.outcomes?.length) {
    parsed = mergeOutcomes(parsed, options.metadata.outcomes);
  }

  return { parsed, precogRef };
}

/**
 * Full enrichment including async Precog market fetch when reference detected.
 */
export async function enrichPredictionDisplay(
  questionText: string,
  templateId?: string | number | bigint | null,
  options?: {
    subgraphOutcomes?: unknown;
    subgraphCategory?: string | null;
    metadata?: PredictionMetadataOverride | PredictionMetadataInput | null;
    fetchImpl?: typeof fetch;
  }
): Promise<EnrichedPredictionDisplay> {
  const base = enrichPredictionDisplaySync(questionText, templateId, options);

  if (!base.precogRef) return base;

  const precog = await fetchPrecogMarket(
    base.precogRef.chainId,
    base.precogRef.marketId,
    options?.fetchImpl
  );

  if (!precog) return base;

  let parsed = base.parsed;
  if (precog.title?.trim()) {
    parsed = { ...parsed, title: precog.title.trim() };
  }
  if (precog.category?.trim()) {
    parsed = { ...parsed, category: precog.category.trim() };
  }
  if (precog.outcomes.length > 0) {
    parsed = {
      ...parsed,
      type: "single-select",
      outcomes: precog.outcomes,
    };
  }

  return { parsed, precogRef: base.precogRef };
}
