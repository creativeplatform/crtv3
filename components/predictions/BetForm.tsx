"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { base } from "@account-kit/infra";
import {
  createPublicClient,
  http,
  fallback,
  parseEther,
  keccak256,
  stringToHex,
} from "viem";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitAnswer } from "@/lib/sdk/reality-eth/reality-eth-question-wrapper";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import { usePredictionAccess } from "@/lib/hooks/predictions/usePredictionAccess";
import { logger } from '@/lib/utils/logger';
import type { ParsedPredictionDisplay } from "@/lib/predictions/parse-prediction-display";
import {
  estimateEarningsIfWin,
  formatEth,
  minBondRequired,
  resolveSelectedAnswerHex,
  type StakeStats,
} from "@/lib/predictions/stake-stats";


const betSchema = z.object({
  answer: z.string().min(1, "Please select an answer"),
  bond: z.string().min(1, "Bond amount is required"),
});

type BetFormData = z.infer<typeof betSchema>;

interface BetFormProps {
  questionId: string;
  questionType: "bool" | "single-select" | "multiple-select" | "uint";
  outcomes?: string[];
  stakeStats?: StakeStats | null;
  parsed?: ParsedPredictionDisplay;
  minBond?: bigint;
  leadingBond?: bigint;
  leadingAnswerHex?: string;
}

export function BetForm({
  questionId,
  questionType,
  outcomes,
  stakeStats = null,
  parsed,
  minBond = 0n,
  leadingBond = 0n,
  leadingAnswerHex,
}: BetFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, walletAddress } = useWalletStatus();
  const {
    canBetOnPrediction,
    blockReason,
    isLoading: isAccessLoading,
  } = usePredictionAccess();
  const { client: accountKitClient } = useSmartAccountClient({});

  const canBet = isConnected && canBetOnPrediction;

  const form = useForm<BetFormData>({
    resolver: zodResolver(betSchema),
    defaultValues: {
      answer: "",
      bond: "0.01", // Default 0.01 ETH
    },
  });

  const watchedAnswer = form.watch("answer");
  const watchedBond = form.watch("bond");

  const requiredMinBond = useMemo(
    () => minBondRequired(minBond, leadingBond),
    [minBond, leadingBond]
  );

  const selectedOutcomeLabel = useMemo(() => {
    if (!watchedAnswer || !parsed) return null;
    if (questionType === "bool") {
      return watchedAnswer === "true" ? "Yes" : "No";
    }
    if (questionType === "single-select" && outcomes) {
      const idx = parseInt(watchedAnswer, 10);
      return outcomes[idx] ?? null;
    }
    return null;
  }, [watchedAnswer, parsed, questionType, outcomes]);

  const estimatedEarnings = useMemo(() => {
    if (!stakeStats || !parsed || !watchedAnswer || !watchedBond) return null;
    let userBond: bigint;
    try {
      userBond = parseEther(watchedBond);
    } catch {
      return null;
    }
    const answerHex = resolveSelectedAnswerHex(
      watchedAnswer,
      questionType,
      outcomes
    );
    if (!answerHex) return null;
    return estimateEarningsIfWin({
      stats: stakeStats,
      selectedAnswerHex: answerHex,
      userBond,
    });
  }, [stakeStats, parsed, watchedAnswer, watchedBond, questionType, outcomes]);

  async function onSubmit(values: BetFormData) {
    setError(null);

    if (!canBet) {
      setError(
        blockReason ??
          "Please connect your wallet to place a bet."
      );
      return;
    }

    if (!isConnected || !walletAddress) {
      setError("Please connect your wallet.");
      return;
    }

    if (!accountKitClient) {
      setError("Wallet client not ready. Please try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: fallback([
          http(process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
            ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
            : undefined),
          http("https://mainnet.base.org"),
        ]),
      });

      // Convert answer to bytes32
      // For bool: 0x0000...0001 for true, 0x0000...0000 for false
      // For single-select: keccak256 of the selected outcome
      let answerBytes32: `0x${string}`;

      if (questionType === "bool") {
        answerBytes32 =
          values.answer === "true"
            ? ("0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`)
            : ("0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`);
      } else if (questionType === "single-select" && outcomes) {
        // Hash the selected outcome
        const selectedOutcome = outcomes[parseInt(values.answer)];
        answerBytes32 = keccak256(stringToHex(selectedOutcome)) as `0x${string}`;
      } else {
        throw new Error("Unsupported question type for betting");
      }

      const bond = parseEther(values.bond);

      if (bond < requiredMinBond) {
        setError(
          `Bond must be at least ${formatEth(requiredMinBond)} ETH to participate.`
        );
        setIsSubmitting(false);
        return;
      }

      const zeroAnswer =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
      if (
        leadingAnswerHex &&
        leadingAnswerHex.toLowerCase() !== zeroAnswer &&
        answerBytes32.toLowerCase() === leadingAnswerHex.toLowerCase()
      ) {
        setError(
          "You cannot submit the same answer as the current leading answer."
        );
        setIsSubmitting(false);
        return;
      }

      const maxPrevious = 0n; // Start with 0, can be increased for higher bonds

      const hash = await submitAnswer(publicClient, accountKitClient as any, {
        questionId,
        answer: answerBytes32,
        maxPrevious,
        bond,
      });

      toast.success("Bet placed successfully!");
      form.reset();
    } catch (err: any) {
      logger.error("Error placing bet:", err);
      let errorMessage = err?.message || "Failed to place bet. Please try again.";

      // Improve error message for common issues
      if (errorMessage.includes("ABI encoding params")) {
        errorMessage = "Contract interaction error. Please contact support.";
      } else if (errorMessage.includes("insufficient funds")) {
        errorMessage = "Insufficient funds to place bet.";
      }

      setError(errorMessage);
      toast.error("Failed to place bet");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Debug logging
  logger.debug("🎲 BetForm Rendering:", { questionId, questionType, outcomes, canBet });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          name="answer"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Answer</FormLabel>
              <FormControl>
                {questionType === "bool" ? (
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="answer-true" />
                      <Label htmlFor="answer-true">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="answer-false" />
                      <Label htmlFor="answer-false">No</Label>
                    </div>
                  </RadioGroup>
                ) : questionType === "single-select" && outcomes ? (
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex flex-col gap-2"
                  >
                    {outcomes.map((outcome, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <RadioGroupItem
                          value={idx.toString()}
                          id={`answer-${idx}`}
                        />
                        <Label htmlFor={`answer-${idx}`}>{outcome}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Input {...field} placeholder="Enter your answer" />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="bond"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bond Amount (ETH)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="0.01"
                  {...field}
                />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-gray-500">
                The bond amount you&apos;re staking on this answer. Higher bonds
                have more weight.
                {requiredMinBond > 0n && (
                  <>
                    {" "}
                    Minimum: {formatEth(requiredMinBond)} ETH.
                  </>
                )}
              </p>
              {stakeStats && stakeStats.totalPrizePool > 0n && (
                <p className="text-xs text-muted-foreground">
                  Prize pool: {formatEth(stakeStats.totalPrizePool)} ETH
                </p>
              )}
              {estimatedEarnings != null && selectedOutcomeLabel && (
                <p
                  className="text-xs text-emerald-600 dark:text-emerald-400"
                  title="Approximate payout if this outcome wins. Actual winnings depend on final bonds and bounty distribution."
                >
                  If &quot;{selectedOutcomeLabel}&quot; wins, you could earn
                  ~{formatEth(estimatedEarnings)} ETH (approximate).
                </p>
              )}
            </FormItem>
          )}
        />

        {error && (
          <div className="text-red-500 text-sm font-medium whitespace-pre-line">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !canBet || isAccessLoading}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing Bet...
            </>
          ) : !isConnected ? (
            "Connect Wallet to Bet"
          ) : !canBetOnPrediction ? (
            "Not Available"
          ) : (
            "Place Bet"
          )}
        </Button>
      </form>
    </Form>
  );
}
