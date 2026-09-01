"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ArrowRight, Clock } from "lucide-react";
import { queryRealityEthSubgraph } from "@/lib/subgraph/query-reality-eth-subgraph";
import { enrichPredictionDisplaySync } from "@/lib/predictions/enrich-prediction-display";
import {
  answerBytesToLabel,
  formatCategoryLabel,
} from "@/lib/predictions/parse-prediction-display";
import { formatEth, type ListStakeSummary } from "@/lib/predictions/stake-stats";
import { GET_QUESTIONS } from "@/lib/sdk/reality-eth/reality-eth-subgraph";

export type PredictionStripItem = {
  questionId: string;
  title: string | null;
  category: string | null;
  questionType: string | null;
  outcomes: string[] | null;
  createdAt: string | null;
};

type SubgraphQuestion = {
  id: string;
  template_id: string;
  question: string;
  created: string;
  opening_ts: string;
  timeout: string;
  finalize_ts?: string;
  is_pending_arbitration: boolean;
  bounty: string;
  best_answer?: string;
  history_hash: string;
  arbitrator: string;
  min_bond: string;
  last_bond: string;
  last_bond_ts?: string;
  category?: string;
  language?: string;
  outcomes?: string[] | string;
};

type HydratedPrediction = {
  questionId: string;
  title: string;
  description?: string;
  category: string;
  outcomes: string[];
  leadingLabel: string | null;
  isActive: boolean;
  isClosed: boolean;
  isResolved: boolean;
  closingDate: string | null;
  poolEth: string | null;
};

interface ActivePredictionsStripProps {
  videoAssetId: string;
  linkedPredictions: PredictionStripItem[];
}

export function ActivePredictionsStrip({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for the preset picker (follow-up PR)
  videoAssetId,
  linkedPredictions,
}: ActivePredictionsStripProps) {
  const [hydrated, setHydrated] = useState<HydratedPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Quiet retry attempts while some links are not yet indexed by the
  // Reality.eth subgraph (see load() for why that happens).
  const [refetchCount, setRefetchCount] = useState(0);

  // 10s apart, capped — enough for normal subgraph indexing lag without
  // spinning forever on a link the subgraph will never index.
  const UNINDEXED_REFETCH_MS = 10_000;
  const MAX_UNINDEXED_REFETCHS = 6;

  function scheduleUnindexedRetry() {
    window.setTimeout(() => setRefetchCount((n) => n + 1), UNINDEXED_REFETCH_MS);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      if (linkedPredictions.length === 0) {
        if (!cancelled) {
          setHydrated([]);
          setLoading(false);
        }
        return;
      }

      const ids = linkedPredictions.map((p) => p.questionId.toLowerCase());

      const data = await queryRealityEthSubgraph<{
        questions: SubgraphQuestion[];
      }>(GET_QUESTIONS, {
        first: ids.length,
        skip: 0,
        where: { id_in: ids },
      });

      // Subgraph indexing lag: a just-created market's link row exists (written
      // by the record POST) before the Reality.eth subgraph indexes the
      // question. Missing questions render as pending fallback cards from the
      // stored metadata instead of vanishing the strip.
      const indexedQuestions = data?.questions ?? [];
      const indexedIds = new Set(
        indexedQuestions.map((q) => q.id.toLowerCase()),
      );
      const unindexed = linkedPredictions.filter(
        (p) => !indexedIds.has(p.questionId.toLowerCase()),
      );

      // While some links are unindexed, retry quietly so the card flips to a
      // fully hydrated one without a manual refresh. Cap to avoid an infinite
      // loop if a link points at a question the subgraph will never index
      // (e.g. created outside Creative TV and pruned).
      if (unindexed.length > 0 && refetchCount < MAX_UNINDEXED_REFETCHS) {
        scheduleUnindexedRetry();
      }

      if (!indexedQuestions.length) {
        // Every linked question is still unindexed: render pending cards
        // from stored metadata rather than an empty "not indexed" state.
        const allPending: HydratedPrediction[] = linkedPredictions.map((p) => ({
          questionId: p.questionId,
          title: p.title || "Pending prediction",
          category: p.category ?? "general",
          outcomes: p.outcomes ?? ["Yes", "No"],
          leadingLabel: null,
          isActive: false,
          isClosed: false,
          isResolved: false,
          closingDate: null,
          poolEth: null,
        }));
        if (!cancelled) {
          setHydrated(allPending);
          setLoading(false);
        }
        return;
      }

      const metadataByQuestion = new Map(
        linkedPredictions.map((p) => [p.questionId.toLowerCase(), p])
      );

      const statsRes = await fetch(
        `/api/predictions/stake-stats?ids=${encodeURIComponent(ids.join(","))}`
      ).catch(() => null);
      const stats: Record<string, ListStakeSummary> = statsRes?.ok
        ? (await statsRes.json()).stats ?? {}
        : {};

      const parsed: HydratedPrediction[] = indexedQuestions.map((q) => {
        const rawQuestion = q.question || "";
        const subgraphOutcomes: string[] =
          typeof q.outcomes === "string"
            ? q.outcomes.split("\n").filter(Boolean)
            : Array.isArray(q.outcomes)
              ? q.outcomes
              : [];
        const meta = metadataByQuestion.get(q.id.toLowerCase());

        const { parsed: display } = enrichPredictionDisplaySync(
          rawQuestion,
          q.template_id,
          {
            subgraphOutcomes,
            subgraphCategory: q.category ?? meta?.category ?? null,
            metadata: meta
              ? {
                  title: meta.title,
                  questionType: meta.questionType,
                  category: meta.category,
                  outcomes: meta.outcomes ?? null,
                }
              : null,
          }
        );

        const outcomes =
          subgraphOutcomes.length > 0
            ? subgraphOutcomes
            : display.outcomes.length > 0
              ? display.outcomes
              : ["Yes", "No"];
        const enrichedDisplay: {
          title: string;
          type: "bool" | "uint" | "single-select" | "multiple-select";
          outcomes: string[];
          category: string;
          language: string;
          description?: string;
        } = { ...display, outcomes };
        const leadingLabel = q.best_answer
          ? answerBytesToLabel(q.best_answer, enrichedDisplay)
          : null;

        const now = Math.floor(Date.now() / 1000);
        const openingTs = Number(q.opening_ts);
        const timeout = Number(q.timeout);
        const finalizeTs = Number(q.finalize_ts ?? 0);
        const lastBondTs = Number(q.last_bond_ts ?? 0);
        const inferredFinalizeTs =
          lastBondTs > 0 && timeout > 0 ? lastBondTs + timeout : 0;
        const effectiveFinalizeTs =
          finalizeTs > 0 ? finalizeTs : inferredFinalizeTs;

        const isClosed = timeout > 0 && openingTs + timeout <= now;
        const isResolved =
          Boolean(leadingLabel) && effectiveFinalizeTs > 0 && effectiveFinalizeTs <= now;
        const isActive = !isClosed && !isResolved;

        const stakeSummary = stats[q.id.toLowerCase()];
        const poolWei =
          stakeSummary && BigInt(stakeSummary.totalPrizePool) > 0n
            ? BigInt(stakeSummary.totalPrizePool)
            : q.bounty && Number(q.bounty) > 0
              ? BigInt(q.bounty)
              : null;

        return {
          questionId: q.id,
          title: display.title || "Untitled Prediction",
          description: display.description,
          category: meta?.category ?? display.category,
          outcomes,
          leadingLabel,
          isActive,
          isClosed,
          isResolved,
          closingDate:
            timeout > 0
              ? new Date((openingTs + timeout) * 1000).toLocaleString()
              : null,
          poolEth: poolWei != null ? formatEth(poolWei) : null,
        };
      });

      parsed.sort((a, b) => {
        const score = (x: HydratedPrediction) =>
          x.isActive ? 2 : x.isResolved ? 1 : 0;
        return score(b) - score(a);
      });

      // Pending fallback cards for links the subgraph has not indexed yet:
      // title/category/outcomes from the stored record metadata, no pool or
      // leading answer yet. Sorted after everything already live.
      const pending: HydratedPrediction[] = unindexed.map((p) => ({
        questionId: p.questionId,
        title: p.title || "Pending prediction",
        category: p.category ?? "general",
        outcomes: p.outcomes ?? ["Yes", "No"],
        leadingLabel: null,
        isActive: false,
        isClosed: false,
        isResolved: false,
        closingDate: null,
        poolEth: null,
      }));

      if (!cancelled) {
        setHydrated([...pending, ...parsed]);
      }
    }

    load().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to load predictions");
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [linkedPredictions, refetchCount]);

  if (linkedPredictions.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">
          Active predictions for this video
        </h3>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-4 border-dashed">
          <p className="text-sm text-red-500">{error}</p>
        </Card>
      ) : hydrated.length === 0 ? (
        <Card className="p-4 border-dashed">
          <p className="text-sm text-muted-foreground">
            Predictions were linked but are not yet indexed. They should appear
            shortly.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {hydrated.map((p) => (
            <Card key={p.questionId} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h4 className="font-semibold line-clamp-2">{p.title}</h4>
                    {p.isActive && <Badge variant="default">Active</Badge>}
                    {p.isResolved && <Badge variant="secondary">Resolved</Badge>}
                    {p.isClosed && !p.isResolved && (
                      <Badge variant="outline">Closed</Badge>
                    )}
                    {p.category && (
                      <Badge variant="outline" className="text-xs">
                        {formatCategoryLabel(p.category)}
                      </Badge>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {p.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                    {p.closingDate && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Closes {p.closingDate}
                      </span>
                    )}
                    {p.poolEth && <span>Pool: {p.poolEth} ETH</span>}
                    {p.leadingLabel && !p.isResolved && (
                      <span>Leading: {p.leadingLabel}</span>
                    )}
                    {p.leadingLabel && p.isResolved && (
                      <span>Result: {p.leadingLabel}</span>
                    )}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href={`/predict/${p.questionId}`}>
                    Participate
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
