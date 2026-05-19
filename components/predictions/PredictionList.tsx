"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Clock } from "lucide-react";
import { request, gql } from "graphql-request";
import { getAddress, isAddress } from "viem";
import { logger } from "@/lib/utils/logger";
import {
  GET_LOG_NEW_QUESTIONS_LIST,
  GET_QUESTIONS_LIST,
  GET_QUESTIONS_LIST_BY_OPENING_TS,
  GET_QUESTIONS_LIST_MINIMAL,
} from "@/lib/sdk/reality-eth/reality-eth-subgraph";

const APP_ARBITRATOR = "0x0000000000000000000000000000000000000000";

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
}

/**
 * PredictionList Component
 * 
 * Displays a list of active Reality.eth prediction questions.
 * Fetches questions via /api/reality-eth-subgraph (Graph Studio or Goldsky).
 */
const ITEMS_PER_PAGE = 20;

export function PredictionList() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  /** true = Creative TV only (zero arbitrator); false = all indexed Reality.eth questions */
  const [showOnlyAppQuestions, setShowOnlyAppQuestions] = useState(true);

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

        // First, try to introspect the schema to see what fields are available
        const INTROSPECTION_QUERY = gql`
          query IntrospectSchema {
            __schema {
              queryType {
                fields {
                  name
                  type {
                    name
                    kind
                  }
                }
              }
            }
          }
        `;

        try {
          const introspectionData = await request(endpoint, INTROSPECTION_QUERY) as any;
          logger.debug('📋 Available query fields:', introspectionData?.__schema?.queryType?.fields);
        } catch (introError) {
          logger.warn('⚠️ Could not introspect schema:', introError);
        }

        // Graph Studio (creative-platform) exposes `questions`. Goldsky reality-eth uses `logNewQuestions`.
        // Try `questions` first so Studio works; prefer a non-empty list if a later query shape returns [].
        const variables = {
          first: 200,
          skip: 0,
        };

        const alternativeQueries = [
          { field: "questions" as const, query: GET_QUESTIONS_LIST, label: "questions(orderBy:created)" },
          { field: "questions" as const, query: GET_QUESTIONS_LIST_BY_OPENING_TS, label: "questions(orderBy:opening_ts)" },
          { field: "questions" as const, query: GET_QUESTIONS_LIST_MINIMAL, label: "questions(minimal fields)" },
          { field: "logNewQuestions" as const, query: GET_LOG_NEW_QUESTIONS_LIST, label: "logNewQuestions" },
          { field: "log_new_questions" as const, query: gql`query GetQuestions($first: Int!, $skip: Int!) { log_new_questions(first: $first, skip: $skip, orderBy: opening_ts, orderDirection: desc) { id question_id template_id question arbitrator opening_ts timeout } }`, label: "log_new_questions" },
        ];

        let data: any = null;
        let lastQueryError: any = null;
        let usedField: (typeof alternativeQueries)[number]["field"] | null = null;

        for (const alt of alternativeQueries) {
          try {
            logger.debug(`Trying subgraph query: ${alt.label}`);
            const result = await request(endpoint, alt.query, variables) as any;
            const rows = result?.[alt.field];
            if (!Array.isArray(rows)) continue;
            if (rows.length > 0) {
              data = result;
              usedField = alt.field;
              logger.debug(`Using subgraph query: ${alt.label} (${rows.length} rows)`);
              break;
            }
            if (!data) {
              data = result;
              usedField = alt.field;
              logger.debug(`Subgraph query ${alt.label} returned 0 rows; will replace if a later query has data`);
            }
          } catch (e: any) {
            lastQueryError = e;
            logger.debug(`${alt.label} query failed:`, e?.message || e);
          }
        }

        if (!data || !usedField) {
          const errMsg = lastQueryError?.message || 'Unknown subgraph query error';
          throw new Error(
            "The Reality.eth subgraph doesn't expose a compatible question field. " +
            `Tried: ${alternativeQueries.map(q => q.label).join(', ')}. ` +
            `Last error: ${errMsg}`
          );
        }

        const fetchedQuestions = data[usedField] as any[];

        const parsedQuestions: Question[] = (fetchedQuestions || []).map((q) => {
          let title = q.question || "Untitled Prediction";
          let description: string | undefined;

          try {
            if (q.question && q.question.length > 0) {
              title = q.question;
            }
          } catch (e) {
            logger.warn('Could not parse question text for question', q.id, e);
          }

          if (usedField === "questions") {
            const outcomesRaw = q.outcomes;
            const outcomes =
              typeof outcomesRaw === "string" && outcomesRaw.length > 0
                ? outcomesRaw.split("\n").filter(Boolean)
                : undefined;

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
              category: q.category ?? undefined,
              language: q.language ?? undefined,
              outcomes,
              title,
              description,
            };
          }

          return {
            id: q.question_id || q.id,
            template_id: q.template_id?.toString() || "0",
            question: q.question || "",
            created: q.id || "0",
            opening_ts: q.opening_ts?.toString() || "0",
            timeout: q.timeout?.toString() || "0",
            finalize_ts: undefined,
            is_pending_arbitration: false,
            bounty: "0",
            best_answer: undefined,
            history_hash: "",
            arbitrator: q.arbitrator || "",
            min_bond: "0",
            last_bond: "0",
            last_bond_ts: undefined,
            category: undefined,
            language: undefined,
            outcomes: undefined,
            title,
            description,
          } as Question;
        });

        logger.debug(`Successfully fetched ${parsedQuestions.length} questions from Reality.eth subgraph`);

        // Fetch bounties for these questions
        const questionIds = parsedQuestions.map(q => q.id);

        // `questions` entities already include `bounty`; log-only fallbacks may not.
        if (usedField !== "questions" && questionIds.length > 0) {
          const GET_BOUNTIES_QUERY = gql`
            query GetBounties($questionIds: [String!]) {
              logFundAnswerBounties(
                where: { question_id_in: $questionIds }
                orderBy: timestamp_
                orderDirection: desc
              ) {
                question_id
                bounty
              }
            }
          `;

          try {
            logger.debug('💰 Fetching bounties for questions');
            const bountyData = await request(endpoint, GET_BOUNTIES_QUERY, { questionIds }) as any;
            const bounties = bountyData.logFundAnswerBounties || [];

            const bountyMap = new Map<string, bigint>();

            bounties.forEach((b: any) => {
              const qId = b.question_id;
              const amount = BigInt(b.bounty || 0);
              const current = bountyMap.get(qId) || BigInt(0);
              bountyMap.set(qId, current + amount);
            });

            parsedQuestions.forEach(q => {
              if (bountyMap.has(q.id)) {
                q.bounty = bountyMap.get(q.id)?.toString() || "0";
              }
            });

            logger.debug(`Updated ${bountyMap.size} questions with bounty data`);
          } catch (bountyError) {
            logger.warn('Failed to fetch bounties:', bountyError);
          }
        }

        // Filter to only show questions from this app if enabled (CreatePrediction uses zero arbitrator).
        const appArbNorm = normalizeArbitrator(APP_ARBITRATOR);
        const filteredQuestions = showOnlyAppQuestions
          ? parsedQuestions.filter(
              (q) => normalizeArbitrator(q.arbitrator) === appArbNorm
            )
          : parsedQuestions;

        setAllQuestions(filteredQuestions);

        // Apply pagination
        const safeFilteredQuestions = filteredQuestions || [];
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        setQuestions(safeFilteredQuestions.slice(startIndex, endIndex));
      } catch (err: any) {
        logger.error('Failed to fetch questions from Reality.eth subgraph:', err);

        let errorMessage = err?.message || 'Failed to load predictions.';

        // Provide helpful error messages based on the error type
        if (err?.message?.includes("no field `questions`") ||
          err?.message?.includes("Type `Query` has no field `questions`")) {
          errorMessage =
            "The Reality.eth subgraph schema doesn't match. " +
            "This usually means:\n\n" +
            "• The subgraph hasn't been deployed to Goldsky yet\n" +
            "• The subgraph is still syncing/indexing data\n" +
            "• The subgraph schema uses different field names\n\n" +
            "Please check:\n" +
            "1. Goldsky dashboard - verify the 'reality-eth' subgraph exists\n" +
            "2. Subgraph status - ensure it's synced and indexed\n" +
            "3. Subgraph schema - verify it includes a 'questions' query field";
        } else if (err?.message?.includes("404") || err?.message?.includes("not found")) {
          errorMessage =
            "Reality.eth subgraph not found. " +
            "Please deploy the subgraph to Goldsky first. " +
            "See REALITY_ETH_SUBGRAPH_HOSTING.md for deployment instructions.";
        }

        setError(errorMessage);
        // Set empty arrays on error to prevent undefined errors
        setAllQuestions([]);
        setQuestions([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuestions();
  }, [currentPage, showOnlyAppQuestions])

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

  const totalQuestions = allQuestions?.length || 0;
  const totalPages = totalQuestions > 0 ? Math.ceil(totalQuestions / ITEMS_PER_PAGE) : 1;
  const hasNextPage = totalQuestions > 0 && currentPage < totalPages;
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

  const setFilterCreativeTv = () => {
    setShowOnlyAppQuestions(true);
    setCurrentPage(1);
  };

  const setFilterAllReality = () => {
    setShowOnlyAppQuestions(false);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Source
          </span>
          <div
            className="inline-flex rounded-lg border bg-muted/40 p-1"
            role="group"
            aria-label="Prediction source filter"
          >
            <Button
              type="button"
              variant={showOnlyAppQuestions ? "default" : "ghost"}
              size="sm"
              className="rounded-md shadow-none"
              onClick={setFilterCreativeTv}
              aria-pressed={showOnlyAppQuestions}
            >
              Creative TV
            </Button>
            <Button
              type="button"
              variant={!showOnlyAppQuestions ? "default" : "ghost"}
              size="sm"
              className="rounded-md shadow-none"
              onClick={setFilterAllReality}
              aria-pressed={!showOnlyAppQuestions}
            >
              All Reality.eth
            </Button>
          </div>
          {showOnlyAppQuestions && (
            <p className="text-xs text-muted-foreground max-w-xl">
              Creative TV only lists markets created here with <span className="font-mono">0x0…0</span> arbitrator.
              Questions you create on{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://reality.eth.link"
                target="_blank"
                rel="noopener noreferrer"
              >
                reality.eth
              </a>{" "}
              often use another arbitrator (e.g. Kleros) — switch to <strong>All Reality.eth</strong> to see those.
            </p>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {totalQuestions > 0
            ? `Showing ${questions?.length || 0} of ${totalQuestions} question${totalQuestions === 1 ? "" : "s"}`
            : showOnlyAppQuestions
              ? "No Creative TV predictions in this view"
              : "No predictions in this view"}
        </div>
      </div>

      {totalQuestions === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium text-foreground">No predictions found</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {showOnlyAppQuestions
              ? "Nothing created on Creative TV matches yet. Choose “All Reality.eth” to browse every indexed market on the network."
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
          const isActive = openingTs <= now && (timeout === 0 || (openingTs + timeout) > now);
          const isClosed = timeout > 0 && (openingTs + timeout) <= now;

          return (
            <Card key={question.id} className="p-4 sm:p-6 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="text-lg font-semibold break-all leading-tight min-w-0 pr-1">
                      {question.title || "Untitled Prediction"}
                    </h3>
                    <Badge className="shrink-0 mt-0.5" variant={isActive ? "default" : isClosed ? "secondary" : "outline"}>
                      {isActive ? "Active" : isClosed ? "Closed" : "Pending"}
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
                          ? `Closes: ${new Date((Number(question.opening_ts) + Number(question.timeout)) * 1000).toLocaleString()}`
                          : "No timeout"}
                      </span>
                    </div>
                    {question.bounty && Number(question.bounty) > 0 && (
                      <div>Bounty: {(Number(question.bounty) / 1e18).toFixed(4)} ETH</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full md:w-auto mt-2 md:mt-0">
                  <Link href={`/predict/${question.id}`}>
                    <Button variant="outline" size="sm" className="w-full md:w-auto">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
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
