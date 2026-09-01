"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { base } from "@account-kit/infra";
import { createPublicClient, http, fallback, formatEther } from "viem";
import { request } from "graphql-request";
import {
  getQuestion,
  getFinalAnswer,
  type RealityEthQuestion,
} from "@/lib/sdk/reality-eth/reality-eth-question-wrapper";
import { GET_QUESTION } from "@/lib/sdk/reality-eth/reality-eth-subgraph";
import {
  answerBytesToLabel,
  formatCategoryLabel,
  type ParsedPredictionDisplay,
} from "@/lib/predictions/parse-prediction-display";
import { enrichPredictionDisplay } from "@/lib/predictions/enrich-prediction-display";
import {
  computeStakeStats,
  formatEth,
  type StakeStats,
} from "@/lib/predictions/stake-stats";
import { BetForm } from "./BetForm";
import { ClaimWinningsCard } from "./ClaimWinningsCard";
import { Clock, Share2 } from "lucide-react";
import { logger } from "@/lib/utils/logger";
import { EvidenceSubmissionModal } from "./EvidenceSubmissionModal";
import { ShareDialog } from "@/components/Videos/ShareDialog";
import { Collapsible } from "@/components/ui/collapsible";
import { shortenAddress } from "@/lib/utils/utils";

interface PredictionDetailsProps {
  questionId: string;
}

type QuestionType = ParsedPredictionDisplay["type"];

type AnswerTimelineEntry = {
  answer: string;
  bond: string;
  answerer: string;
  created: string;
  label: string | null;
};

interface QuestionData extends Omit<
  RealityEthQuestion,
  "opening_ts" | "timeout" | "finalize_ts"
> {
  opening_ts: number;
  timeout: number;
  finalize_ts?: number;
  parsed: ParsedPredictionDisplay;
}

export function PredictionDetails({ questionId }: PredictionDetailsProps) {
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [answerTimeline, setAnswerTimeline] = useState<AnswerTimelineEntry[]>(
    []
  );
  const [stakeStats, setStakeStats] = useState<StakeStats | null>(null);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: base,
        transport: fallback([
          http(
            process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
              ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
              : undefined
          ),
          http("https://mainnet.base.org"),
        ]),
      }),
    []
  );

  useEffect(() => {
    async function fetchQuestion() {
      try {
        setIsLoading(true);

        let questionDataRaw;
        try {
          questionDataRaw = await getQuestion(publicClient, questionId);
        } catch (questionError: unknown) {
          const msg =
            questionError instanceof Error ? questionError.message : "";
          logger.error("Error fetching question from contract:", questionError);
          if (
            msg.includes("is_native") ||
            msg.includes("Cannot set properties")
          ) {
            throw new Error(
              "Reality.eth configuration error. The question may not exist or the contract configuration is invalid."
            );
          }
          throw questionError;
        }

        let metadata: {
          title?: string | null;
          questionType?: string | null;
          category?: string | null;
          outcomes?: string[] | null;
        } | null = null;

        try {
          const metaRes = await fetch(
            `/api/predictions/metadata?questionId=${encodeURIComponent(questionId)}`
          );
          if (metaRes.ok) {
            const metaJson = (await metaRes.json()) as {
              metadata?: typeof metadata;
            };
            metadata = metaJson.metadata ?? null;
          }
        } catch (metaErr) {
          logger.debug("Prediction metadata fetch skipped:", metaErr);
        }

        let subgraphOutcomes: unknown;
        let subgraphCategory: string | null = null;
        let timeline: AnswerTimelineEntry[] = [];
        let parsedDisplay: ParsedPredictionDisplay | null = null;
        let subgraphAnswers: Array<{
          answer: string;
          bond: string;
          answerer: string;
          created: string;
        }> = [];

        if (typeof window !== "undefined") {
          try {
            const endpoint = `${window.location.origin}/api/reality-eth-subgraph`;
            const subgraphData = (await request(endpoint, GET_QUESTION, {
              id: questionId,
            })) as {
              question?: {
                outcomes?: string;
                category?: string;
                answers?: Array<{
                  answer: string;
                  bond: string;
                  answerer: string;
                  created: string;
                }>;
              };
            };

            subgraphOutcomes = subgraphData?.question?.outcomes;
            subgraphCategory = subgraphData?.question?.category ?? null;
            subgraphAnswers = subgraphData?.question?.answers ?? [];

            const { parsed: previewParsed } = await enrichPredictionDisplay(
              questionDataRaw.question ?? "",
              questionDataRaw.template_id,
              { subgraphOutcomes, subgraphCategory, metadata }
            );
            parsedDisplay = previewParsed;

            timeline = subgraphAnswers
              .slice()
              .reverse()
              .slice(0, 8)
              .map((a) => ({
                answer: a.answer,
                bond: a.bond,
                answerer: a.answerer,
                created: a.created,
                label: answerBytesToLabel(a.answer, previewParsed),
              }));
          } catch (subErr) {
            logger.debug("Subgraph enrichment skipped:", subErr);
          }
        }

        const parsed =
          parsedDisplay ??
          (
            await enrichPredictionDisplay(
              questionDataRaw.question ?? "",
              questionDataRaw.template_id,
              { subgraphOutcomes, subgraphCategory, metadata }
            )
          ).parsed;

        const questionData: QuestionData = {
          ...questionDataRaw,
          opening_ts: Number(questionDataRaw.opening_ts),
          timeout: Number(questionDataRaw.timeout),
          finalize_ts: questionDataRaw.finalize_ts
            ? Number(questionDataRaw.finalize_ts)
            : undefined,
          parsed,
        };

        const computedStake = computeStakeStats({
          bounty: questionDataRaw.bounty ?? 0n,
          minBond: questionDataRaw.min_bond ?? 0n,
          leadingBond: questionDataRaw.bond ?? 0n,
          answers: subgraphAnswers,
          parsed,
        });

        setQuestion(questionData);
        setAnswerTimeline(timeline);
        setStakeStats(computedStake);

        try {
          const answer = await getFinalAnswer(publicClient, questionId);
          if (
            answer &&
            answer !==
              "0x0000000000000000000000000000000000000000000000000000000000000000"
          ) {
            setFinalAnswer(answer);
          }
        } catch {
          logger.debug("Question not yet resolved or error fetching answer");
        }
      } catch (err: unknown) {
        logger.error("Error fetching question:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load prediction"
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (questionId) {
      fetchQuestion();
    }
  }, [questionId, publicClient]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <div className="font-semibold">Failed to load prediction</div>
        <div className="text-sm mt-1">{error}</div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="p-4">
        <div>Prediction not found</div>
      </div>
    );
  }

  const { parsed } = question;
  const now = Math.floor(Date.now() / 1000);
  const isActive =
    question.opening_ts <= now &&
    (question.timeout === 0 ||
      question.opening_ts + question.timeout > now);
  const isFinalizing = question.finalize_ts && question.finalize_ts > now;
  const isPendingArbitration = question.is_pending_arbitration;
  const isResolved = finalAnswer !== null;

  const finalLabel = finalAnswer
    ? answerBytesToLabel(finalAnswer, parsed)
    : null;
  const leadingLabel = question.best_answer
    ? answerBytesToLabel(question.best_answer, parsed)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-3">{parsed.title}</h1>
        <div className="flex gap-2 items-center flex-wrap mb-4">
          <Badge variant="outline">{formatCategoryLabel(parsed.category)}</Badge>
          <Badge variant="secondary">{parsed.language}</Badge>
          {isResolved ? (
            <Badge variant="secondary">Resolved</Badge>
          ) : isPendingArbitration ? (
            <Badge variant="destructive">Arbitration Pending</Badge>
          ) : isFinalizing ? (
            <Badge className="bg-yellow-500 hover:bg-yellow-600">Finalizing</Badge>
          ) : isActive ? (
            <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
          ) : (
            <Badge variant="secondary">Closed</Badge>
          )}
          {!isResolved && (
            <EvidenceSubmissionModal questionId={questionId} />
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShareOpen(true)}
            title="Share Prediction"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-1 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              Opened:{" "}
              {new Date(Number(question.opening_ts) * 1000).toLocaleString()}
            </span>
          </div>
          {isActive && question.timeout > 0 && (
            <div>
              Closes:{" "}
              {new Date(
                (Number(question.opening_ts) + Number(question.timeout)) * 1000
              ).toLocaleString()}
            </div>
          )}
          {isFinalizing && question.finalize_ts && (
            <div className="font-semibold text-yellow-600 dark:text-yellow-400">
              Finalizes:{" "}
              {new Date(Number(question.finalize_ts) * 1000).toLocaleString()}
            </div>
          )}
          {question.bounty && Number(question.bounty) > 0 && (
            <div>Bounty: {Number(formatEther(question.bounty)).toFixed(3)} ETH</div>
          )}
          {!isResolved && question.bond && Number(question.bond) > 0 && (
            <div>
              Current bond backing:{" "}
              {Number(formatEther(question.bond)).toFixed(4)} ETH
            </div>
          )}
        </div>
      </div>

      {parsed.description && (
        <div className="text-foreground/90">{parsed.description}</div>
      )}

      {stakeStats && stakeStats.totalPrizePool > 0n && (
        <Card className="p-4 bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800">
          <h3 className="text-sm font-medium text-violet-700 dark:text-violet-300 mb-1">
            {isResolved ? "Settled pool" : "At stake"}
          </h3>
          <div className="text-2xl font-bold text-violet-900 dark:text-violet-100">
            {formatEth(stakeStats.totalPrizePool)} ETH
          </div>
          <div className="mt-2 text-xs text-violet-700/80 dark:text-violet-300/80 space-y-0.5">
            {stakeStats.bounty > 0n && (
              <div>Bounty: {formatEth(stakeStats.bounty)} ETH</div>
            )}
            {!isResolved && stakeStats.totalBonded > 0n && (
              <div>Total bonded: {formatEth(stakeStats.totalBonded)} ETH</div>
            )}
            {!isResolved && stakeStats.minBond > 0n && (
              <div>Min bond: {formatEth(stakeStats.minBond)} ETH</div>
            )}
          </div>
        </Card>
      )}

      {parsed.outcomes.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Outcomes
          </h3>
          <div className="flex flex-wrap gap-2">
            {parsed.outcomes.map((o) => {
              const isFinal = isResolved && finalLabel === o;
              const isLeading = !isResolved && leadingLabel === o;
              const outcomeStake = stakeStats?.perOutcome.find(
                (entry) => entry.label === o
              );
              return (
                <Badge
                  key={o}
                  variant={isFinal || isLeading ? "default" : "outline"}
                >
                  {o}
                  {!isResolved &&
                  outcomeStake &&
                  outcomeStake.totalBond > 0n
                    ? ` · ${formatEth(outcomeStake.totalBond)} ETH`
                    : ""}
                  {!isResolved && isLeading ? " · leading" : ""}
                </Badge>
              );
            })}
          </div>
        </Card>
      )}

      {isResolved && finalLabel ? (
        <>
          <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <div className="text-sm text-green-600 dark:text-green-300 mb-1">
              Final Answer
            </div>
            <div className="font-semibold text-green-800 dark:text-green-200 text-xl">
              {finalLabel}
            </div>
          </Card>
          <ClaimWinningsCard
            questionId={questionId}
            finalAnswer={finalAnswer}
            parsed={parsed}
          />
        </>
      ) : (
        leadingLabel &&
        question.best_answer !==
          "0x0000000000000000000000000000000000000000000000000000000000000000" && (
          <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-600 dark:text-blue-300 mb-1">
              Current leading answer
            </div>
            <div className="font-semibold text-blue-800 dark:text-blue-200 text-xl">
              {leadingLabel}
            </div>
            {question.bond && Number(question.bond) > 0 && (
              <div className="text-xs text-blue-600/80 mt-2">
                Bond backing: {Number(formatEther(question.bond)).toFixed(4)} ETH
              </div>
            )}
            {isFinalizing && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                If no higher bond is posted before finalization, this becomes the
                final result.
              </div>
            )}
          </Card>
        )
      )}

      {answerTimeline.length > 0 &&
        (isResolved ? (
          <Collapsible
            defaultOpen={false}
            trigger={`Answer history (${answerTimeline.length})`}
          >
            <ul className="space-y-2 text-sm">
              {answerTimeline.map((entry, idx) => (
                <li
                  key={`${entry.answerer}-${entry.created}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <span className="font-medium">
                      {entry.label ?? "Unknown answer"}
                    </span>
                    {entry.answerer && (
                      <span className="ml-2 text-xs text-muted-foreground font-mono">
                        {shortenAddress(entry.answerer)}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {Number(formatEther(BigInt(entry.bond || "0"))).toFixed(4)}{" "}
                    ETH
                  </span>
                </li>
              ))}
            </ul>
          </Collapsible>
        ) : (
          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Recent answers
            </h3>
            <ul className="space-y-2 text-sm">
              {answerTimeline.map((entry, idx) => (
                <li
                  key={`${entry.answerer}-${entry.created}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <span className="font-medium">
                      {entry.label ?? "Unknown answer"}
                    </span>
                    {entry.answerer && (
                      <span className="ml-2 text-xs text-muted-foreground font-mono">
                        {shortenAddress(entry.answerer)}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {Number(formatEther(BigInt(entry.bond || "0"))).toFixed(4)}{" "}
                    ETH
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {isActive && !isResolved && (
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">Place Your Bet</h2>
          <BetForm
            questionId={questionId}
            questionType={parsed.type as QuestionType}
            outcomes={parsed.outcomes}
            stakeStats={stakeStats}
            parsed={parsed}
            minBond={question.min_bond}
            leadingBond={question.bond}
            leadingAnswerHex={question.best_answer}
          />
        </Card>
      )}

      {!isActive && !isResolved && !isFinalizing && (
        <Card className="p-4 bg-muted/40">
          <div className="text-muted-foreground">
            This prediction is closed.{" "}
            {isPendingArbitration
              ? "It is currently in arbitration."
              : "Waiting for resolution."}
          </div>
        </Card>
      )}

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        videoTitle={parsed.title}
        videoId={questionId}
        shareUrlOverride={`/predict/${questionId}`}
        titleOverride={parsed.title}
        dialogTitle="Share Prediction"
        shareNoun="prediction"
      />
    </div>
  );
}
