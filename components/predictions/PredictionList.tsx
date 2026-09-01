"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Clock, Gift } from "lucide-react";
import { request } from "graphql-request";
import { getAddress, isAddress } from "viem";
import { logger } from "@/lib/utils/logger";
import {
  GET_QUESTIONS_LIST,
  GET_QUESTIONS_LIST_BY_OPENING_TS,
  GET_QUESTIONS_LIST_MINIMAL,
} from "@/lib/sdk/reality-eth/reality-eth-subgraph";
import {
  answerBytesToLabel,
  formatCategoryLabel,
  normalizeCategoryKey,
} from "@/lib/predictions/parse-prediction-display";
import { enrichPredictionDisplaySync } from "@/lib/predictions/enrich-prediction-display";
import {
  PREDICTION_CATEGORIES,
  ALL_CATEGORIES_VALUE,
} from "@/lib/predictions/categories";
import { PredictiveSearchInput } from "@/components/search/PredictiveSearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import type { UserClaimStatus } from "@/lib/predictions/claim-status";
import {
  formatEth,
  type ListStakeSummary,
} from "@/lib/predictions/stake-stats";

const APP_ARBITRATOR = "0x0000000000000000000000000000000000000000";

type SourceFilter = "creative_tv" | "all";

/** Normalize subgraph Bytes (address or 32-byte word) for comparisons. */
function normalizeArbitrator(hexLike: unknown): string {
  if (hexLike == null) return "";
  let s = typeof hexLike === "string" ? hexLike.trim() : "";
  if (typeof hexLike === "object" && hexLike !== null && "hex" in hexLike) {
    s = String((hexLike as { hex: string }).hex).trim();
  }
  if (!s) return "";
  let lower = s.toLowerCase();
  if (!lower.startsWith("0x")) lower = `0x${lower}`;
  const body = lower.slice(2);
  if (body.length === 64) {
    lower = `0x${body.slice(24)}`;
  }
  if (isAddress(lower)) {
    return getAddress(lower).toLowerCase();
  }
  return lower;
}

interface Question {
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
  outcomes?: string[];
  title?: string;
  description?: string;
  parsedCategory?: string;
  leadingLabel?: string | null;
  claimStatus?: UserClaimStatus | null;
}

function matchesSearchQuery(q: Question, sq: string): boolean {
  const haystack = [
    q.title,
    q.parsedCategory,
    q.category,
    q.description,
    q.question,
    ...(q.outcomes ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(sq);
}

/**
 * PredictionList Component
 * 
 * Displays a list of active Reality.eth prediction questions.
 * Fetches questions via /api/reality-eth-subgraph (Graph Studio or Goldsky).
 */
const ITEMS_PER_PAGE = 20;

export function PredictionList() {
  const [rawQuestions, setRawQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("creative_tv");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES_VALUE);
  const [searchQuery, setSearchQuery] = useState("");
  const [claimStatusMap, setClaimStatusMap] = useState<
    Record<string, UserClaimStatus>
  >({});
  const [stakeStatsMap, setStakeStatsMap] = useState<
    Record<string, ListStakeSummary>
  >({});
  const fetchedClaimStatusRef = useRef<Set<string>>(new Set());
  const fetchedStakeStatsRef = useRef<Set<string>>(new Set());

  const { isConnected, walletAddress, smartAccountAddress } = useWalletStatus();

  useEffect(() => {
    fetchedClaimStatusRef.current.clear();
    setClaimStatusMap({});
  }, [walletAddress, smartAccountAddress]);

  useEffect(() => {
    fetchedStakeStatsRef.current.clear();
    setStakeStatsMap({});
  }, [sourceFilter, categoryFilter, searchQuery, currentPage]);

  useEffect(() => {
    async function fetchQuestions() {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const endpoint = `${window.location.origin}/api/reality-eth-subgraph`;
        logger.debug('🔗 Fetching Reality.eth questions from:', endpoint);

        const variables = {
          first: 200,
          skip: 0,
        };

        // Graph Studio creative-platform subgraph exposes `questions`.
        const studioQueries = [
          { query: GET_QUESTIONS_LIST, label: "questions(orderBy:created)" },
          { query: GET_QUESTIONS_LIST_BY_OPENING_TS, label: "questions(orderBy:opening_ts)" },
          { query: GET_QUESTIONS_LIST_MINIMAL, label: "questions(minimal fields)" },
        ];

        let data: { questions?: unknown[] } | null = null;
        let lastQueryError: Error | null = null;

        for (const candidate of studioQueries) {
          try {
            logger.debug(`Trying subgraph query: ${candidate.label}`);
            const result = await request(endpoint, candidate.query, variables) as {
              questions?: unknown[];
            };
            if (!Array.isArray(result?.questions)) continue;
            data = result;
            logger.debug(`Using subgraph query: ${candidate.label} (${result.questions.length} rows)`);
            break;
          } catch (e) {
            lastQueryError = e instanceof Error ? e : new Error(String(e));
            logger.debug(`${candidate.label} query failed:`, lastQueryError.message);
          }
        }

        if (!data || !Array.isArray(data.questions)) {
          const errMsg = lastQueryError?.message || 'Unknown subgraph query error';
          throw new Error(
            "Subgraph unavailable — check Graph Studio deployment URL. " +
            `Tried: ${studioQueries.map((q) => q.label).join(', ')}. ` +
            `Last error: ${errMsg}`
          );
        }

        const fetchedQuestions = data.questions as any[];

        const parsedQuestions: Question[] = (fetchedQuestions || []).map((q) => {
          const rawQuestion = q.question || "";
          const subgraphOutcomes = q.outcomes;
          const { parsed: display } = enrichPredictionDisplaySync(
            rawQuestion,
            q.template_id,
            {
              subgraphOutcomes,
              subgraphCategory: q.category ?? null,
            }
          );
          const title = display.title;
          const description = display.description;
          const parsedCategory = display.category;
          const outcomes =
            typeof q.outcomes === "string"
              ? q.outcomes.split("\n").filter(Boolean)
              : display.outcomes;
          const enrichedDisplay = { ...display, outcomes };
          const leadingLabel = q.best_answer
            ? answerBytesToLabel(q.best_answer, enrichedDisplay)
            : null;

          return {
            id: q.id,
            template_id: q.template_id?.toString() ?? "0",
            question: q.question ?? "",
            created: q.created?.toString() ?? "0",
            opening_ts: q.opening_ts?.toString() ?? "0",
            timeout: q.timeout?.toString() ?? "0",
            finalize_ts: q.finalize_ts != null ? String(q.finalize_ts) : undefined,
            is_pending_arbitration: Boolean(q.is_pending_arbitration),
            bounty: q.bounty?.toString() ?? "0",
            best_answer: q.best_answer,
            history_hash: q.history_hash ?? "",
            arbitrator: q.arbitrator ?? "",
            min_bond: q.min_bond?.toString() ?? "0",
            last_bond: q.last_bond?.toString() ?? "0",
            last_bond_ts: q.last_bond_ts != null ? String(q.last_bond_ts) : undefined,
            category: q.category ?? parsedCategory,
            language: q.language ?? display.language,
            outcomes,
            title,
            description,
            parsedCategory,
            leadingLabel,
          };
        });

        logger.debug(`Successfully fetched ${parsedQuestions.length} questions from Reality.eth subgraph`);

        setRawQuestions(parsedQuestions);
      } catch (err: any) {
        logger.error('Failed to fetch questions from Reality.eth subgraph:', err);

        let errorMessage = err?.message || 'Failed to load predictions.';

        if (
          err?.message?.includes('Subgraph unavailable') ||
          err?.message?.includes('does not exist')
        ) {
          errorMessage =
            "Predictions subgraph unavailable. " +
            "Redeploy creative-platform to Graph Studio and set GRAPH_STUDIO_CREATIVE_PLATFORM_URL " +
            "(SUBGRAPH_PROVIDER_MODE=studio).";
        } else if (err?.message?.includes('404') || err?.message?.includes('not found')) {
          errorMessage =
            "Graph Studio subgraph not found. " +
            "See GRAPH_STUDIO_MIGRATION.md for deployment instructions.";
        }

        setError(errorMessage);
        setRawQuestions([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuestions();
  }, []);

  const filteredQuestions = useMemo(() => {
    const appArbNorm = normalizeArbitrator(APP_ARBITRATOR);
    let list = rawQuestions;

    if (sourceFilter === "creative_tv") {
      list = list.filter(
        (q) => normalizeArbitrator(q.arbitrator) === appArbNorm
      );
    }

    if (categoryFilter !== ALL_CATEGORIES_VALUE) {
      const key = normalizeCategoryKey(categoryFilter);
      list = list.filter(
        (q) => normalizeCategoryKey(q.parsedCategory ?? q.category ?? "") === key
      );
    }

    if (searchQuery.trim()) {
      const sq = searchQuery.trim().toLowerCase();
      list = list.filter((q) => matchesSearchQuery(q, sq));
    }

    return list;
  }, [rawQuestions, sourceFilter, categoryFilter, searchQuery]);

  const totalQuestions = filteredQuestions.length;
  const totalPages =
    totalQuestions > 0 ? Math.ceil(totalQuestions / ITEMS_PER_PAGE) : 1;

  const questions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredQuestions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredQuestions, currentPage]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      return;
    }

    const resolvedCandidates = questions.filter(
      (q) =>
        q.best_answer &&
        q.best_answer !==
          "0x0000000000000000000000000000000000000000000000000000000000000000" &&
        !fetchedClaimStatusRef.current.has(q.id)
    );

    if (resolvedCandidates.length === 0) return;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        resolvedCandidates.map(async (q) => {
          try {
            const params = new URLSearchParams({
              questionId: q.id,
              address: walletAddress,
            });
            if (smartAccountAddress) {
              params.set("smartAccount", smartAccountAddress);
            }
            const res = await fetch(
              `/api/predictions/claim-status?${params.toString()}`
            );
            if (!res.ok) {
              return [q.id, null] as const;
            }
            const data = (await res.json()) as { status: UserClaimStatus };
            return [q.id, data.status] as const;
          } catch {
            return [q.id, null] as const;
          }
        })
      );
      if (cancelled) return;
      for (const [id] of entries) {
        fetchedClaimStatusRef.current.add(id);
      }
      setClaimStatusMap((prev) => {
        const next = { ...prev };
        for (const [id, status] of entries) {
          if (
            status === "won_pending_claim" ||
            status === "won_withdrawable"
          ) {
            next[id] = status;
          }
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [isConnected, walletAddress, smartAccountAddress, questions]);

  useEffect(() => {
    const pendingIds = questions
      .map((q) => q.id)
      .filter((id) => !fetchedStakeStatsRef.current.has(id));

    if (pendingIds.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/predictions/stake-stats?ids=${encodeURIComponent(pendingIds.join(","))}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          stats?: Record<string, ListStakeSummary>;
        };
        if (cancelled) return;
        for (const id of pendingIds) {
          fetchedStakeStatsRef.current.add(id);
        }
        if (data.stats) {
          setStakeStatsMap((prev) => ({ ...prev, ...data.stats }));
        }
      } catch {
        // Non-fatal
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [questions]);

  const localSuggest = useCallback(
    (query: string) => {
      const sq = query.trim().toLowerCase();
      if (sq.length < 2) return [];
      return filteredQuestions
        .filter((q) => matchesSearchQuery(q, sq))
        .slice(0, 8)
        .map((q) => ({
          questionId: q.id,
          title: q.title || "Prediction",
          subtitle: q.parsedCategory
            ? formatCategoryLabel(q.parsedCategory)
            : undefined,
          href: `/predict/${q.id}`,
        }));
    },
    [filteredQuestions]
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 w-full">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <div className="font-semibold">Failed to load predictions</div>
        <div className="text-sm mt-1">{error}</div>
      </div>
    );
  }

  const totalQuestionsDisplay = filteredQuestions?.length || 0;
  const hasNextPage = totalQuestionsDisplay > 0 && currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (hasPrevPage) {
      setCurrentPage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const setFilter = (filter: SourceFilter) => {
    setSourceFilter(filter);
    setCurrentPage(1);
  };

  const setCategory = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      <PredictiveSearchInput
        scope="predictions"
        placeholder="Search predictions by title, category, or outcomes…"
        onQueryChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        localSuggest={localSuggest}
        className="max-w-xl"
      />

      <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-6 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Source
            </span>
          <div
            className="inline-flex rounded-lg border bg-muted/40 p-1 flex-wrap"
            role="group"
            aria-label="Prediction source filter"
          >
            <Button
              type="button"
              variant={sourceFilter === "creative_tv" ? "default" : "ghost"}
              size="sm"
              className="rounded-md shadow-none"
              onClick={() => setFilter("creative_tv")}
              aria-pressed={sourceFilter === "creative_tv"}
            >
              Creative TV
            </Button>

            <Button
              type="button"
              variant={sourceFilter === "all" ? "default" : "ghost"}
              size="sm"
              className="rounded-md shadow-none"
              onClick={() => setFilter("all")}
              aria-pressed={sourceFilter === "all"}
            >
              All Reality.eth
            </Button>
          </div>
          {sourceFilter === "creative_tv" && (
            <p className="text-xs text-muted-foreground max-w-xl">
              Creative TV lists markets created here with{" "}
              <span className="font-mono">0x0…0</span> arbitrator. Switch to{" "}
              <strong>All Reality.eth</strong> for external arbitrators (e.g. Kleros).
            </p>
          )}

          </div>

          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Category
            </span>
            <Select value={categoryFilter} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES_VALUE}>All categories</SelectItem>
                {PREDICTION_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalQuestionsDisplay > 0
            ? `Showing ${questions?.length || 0} of ${totalQuestionsDisplay} question${totalQuestionsDisplay === 1 ? "" : "s"}`
            : sourceFilter === "creative_tv"
              ? "No Creative TV predictions in this view"
              : "No predictions in this view"}
        </div>
      </div>

      {totalQuestionsDisplay === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium text-foreground">No predictions found</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {sourceFilter === "creative_tv"
              ? "Nothing created on Creative TV matches yet. Choose “All Reality.eth” to browse every indexed market."
              : "There are no indexed Reality.eth questions to show yet, or data is still syncing."}
          </p>
        </div>
      ) : (
        <>
      <div className="flex flex-col gap-4 w-full">
        {questions.map((question) => {
          const now = Math.floor(Date.now() / 1000);
          const openingTs = Number(question.opening_ts);
          const timeout = Number(question.timeout);
          const isActive =
            openingTs <= now &&
            (timeout === 0 || openingTs + timeout > now);
          const isClosed = timeout > 0 && openingTs + timeout <= now;
          const finalizeTs = Number(question.finalize_ts ?? 0);
          const lastBondTs = Number(question.last_bond_ts ?? 0);
          // Creative subgraph only sets finalize_ts on LogFinalize; on-chain
          // Reality.eth sets it to answer_ts + timeout. Infer when missing.
          const inferredFinalizeTs =
            Number.isFinite(lastBondTs) &&
            lastBondTs > 0 &&
            Number.isFinite(timeout) &&
            timeout > 0
              ? lastBondTs + timeout
              : 0;
          const effectiveFinalizeTs =
            Number.isFinite(finalizeTs) && finalizeTs > 0
              ? finalizeTs
              : inferredFinalizeTs;
          const isFinalizing =
            Boolean(question.leadingLabel) &&
            Number.isFinite(effectiveFinalizeTs) &&
            effectiveFinalizeTs > now;
          const claimImpliesResolved = Boolean(claimStatusMap[question.id]);
          const isResolved =
            claimImpliesResolved ||
            (Boolean(question.leadingLabel) &&
              Number.isFinite(effectiveFinalizeTs) &&
              effectiveFinalizeTs > 0 &&
              effectiveFinalizeTs <= now &&
              !question.is_pending_arbitration);

          const statusLabel = isResolved
            ? "Resolved"
            : isFinalizing
              ? "Finalizing"
              : isActive
                ? "Active"
                : isClosed
                  ? "Closed"
                  : "Pending";
          const statusVariant =
            isResolved || isClosed
              ? "secondary"
              : isActive
                ? "default"
                : isFinalizing
                  ? "outline"
                  : "outline";

          return (
            <Link
              key={question.id}
              href={`/predict/${question.id}`}
              className="block"
            >
              <Card className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow">
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold leading-tight">
                          {question.title || "Untitled Prediction"}
                        </h3>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {question.parsedCategory && (
                            <Badge variant="outline" className="text-xs">
                              {formatCategoryLabel(question.parsedCategory)}
                            </Badge>
                          )}
                          {question.leadingLabel &&
                            (isResolved ? (
                              <Badge variant="default" className="text-xs">
                                Final Answer: {question.leadingLabel}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Leading: {question.leadingLabel}
                              </Badge>
                            ))}
                          {claimStatusMap[question.id] && (
                            <Badge className="text-xs bg-emerald-600 hover:bg-emerald-700">
                              <Gift className="h-3 w-3 mr-1" aria-hidden />
                              Claim winnings
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={`shrink-0 mt-0.5${
                          isFinalizing && !isResolved
                            ? " bg-yellow-500 hover:bg-yellow-600 text-white"
                            : ""
                        }`}
                        variant={statusVariant}
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                    {question.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {question.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {Number(question.timeout) > 0
                            ? `Closes: ${new Date(
                                (Number(question.opening_ts) +
                                  Number(question.timeout)) *
                                  1000
                              ).toLocaleString()}`
                            : "No timeout"}
                        </span>
                      </div>
                      {(() => {
                        const stakeSummary =
                          stakeStatsMap[question.id.toLowerCase()];
                        return stakeSummary &&
                          BigInt(stakeSummary.totalPrizePool) > 0n ? (
                          <div>
                            Pool:{" "}
                            {formatEth(BigInt(stakeSummary.totalPrizePool))} ETH
                          </div>
                        ) : question.bounty && Number(question.bounty) > 0 ? (
                          <div>
                            Bounty:{" "}
                            {(Number(question.bounty) / 1e18).toFixed(4)} ETH
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 w-full md:w-auto mt-2 md:mt-0">
                    <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium w-full md:w-auto pointer-events-none">
                      View Details
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={!hasPrevPage || isLoading}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Page {currentPage} of {totalPages}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!hasNextPage || isLoading}
          >
            Next
          </Button>
        </div>
      )}
        </>
      )}
    </div>
  );
}
