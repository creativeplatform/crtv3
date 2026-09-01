"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { base } from "@account-kit/infra";
import { createPublicClient, http, fallback, formatEther } from "viem";
import {
  getAnswerHistory,
  buildClaimWinningsParams,
  claimWinnings as claimWinningsTx,
  withdraw,
} from "@/lib/sdk/reality-eth/reality-eth-question-wrapper";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import { Loader2, Wallet, Gift } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";
import {
  getUserClaimStatus,
  type UserClaimStatus,
} from "@/lib/predictions/claim-status";
import type { ParsedPredictionDisplay } from "@/lib/predictions/parse-prediction-display";

interface ClaimWinningsCardProps {
  questionId: string;
  finalAnswer: string | null;
  parsed: ParsedPredictionDisplay;
}

type ClaimStep = "idle" | "fetching" | "claiming" | "withdrawing" | "done" | "error";

export function ClaimWinningsCard({
  questionId,
  finalAnswer,
  parsed,
}: ClaimWinningsCardProps) {
  const [claimStatus, setClaimStatus] = useState<UserClaimStatus | null>(null);
  const [winningBondTotal, setWinningBondTotal] = useState<bigint>(0n);
  const [contractBalance, setContractBalance] = useState<bigint | null>(null);
  const [step, setStep] = useState<ClaimStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [winningAnswerLabel, setWinningAnswerLabel] = useState<string | null>(
    null
  );

  const { isConnected, walletAddress, smartAccountAddress } = useWalletStatus();
  const { client: accountKitClient } = useSmartAccountClient({});

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

  const refreshStatus = useCallback(async () => {
    if (!walletAddress || !finalAnswer) return;
    setError(null);
    try {
      const result = await getUserClaimStatus({
        publicClient,
        questionId,
        addresses: [walletAddress, smartAccountAddress],
        finalAnswer,
        parsed,
      });
      setClaimStatus(result.status);
      setWinningBondTotal(result.winningBondTotal);
      setContractBalance(result.contractBalance);
      setWinningAnswerLabel(result.winningAnswerLabel);
    } catch (e: unknown) {
      logger.error("Error fetching claim status:", e);
      setError((e as { message?: string })?.message ?? "Failed to check status");
    }
  }, [
    walletAddress,
    smartAccountAddress,
    finalAnswer,
    publicClient,
    questionId,
    parsed,
  ]);

  useEffect(() => {
    if (isConnected && walletAddress && finalAnswer) {
      void refreshStatus();
    } else {
      setClaimStatus(null);
    }
  }, [isConnected, walletAddress, finalAnswer, refreshStatus]);

  const handleClaimAndWithdraw = async () => {
    if (!isConnected || !walletAddress || !accountKitClient) {
      toast.error("Connect your wallet to claim.");
      return;
    }

    setError(null);
    setStep("fetching");

    try {
      const history = await getAnswerHistory(publicClient, questionId);
      if (history.length === 0) {
        setError("No answer history found. Cannot claim.");
        setStep("idle");
        return;
      }

      const { history_hashes, addrs, bonds, answers } =
        buildClaimWinningsParams(history);

      setStep("claiming");
      try {
        await claimWinningsTx(publicClient, accountKitClient as any, {
          questionId,
          history_hashes,
          addrs,
          bonds,
          answers,
        });
        toast.success("Winnings distributed.");
      } catch (claimError: unknown) {
        const msg =
          claimError instanceof Error ? claimError.message : "";
        logger.warn("Claim warning (might be already claimed):", claimError);

        if (
          msg.toLowerCase().includes("already") ||
          msg.toLowerCase().includes("revert")
        ) {
          toast.info("Winnings might already be distributed. Checking balance...");
        } else {
          toast.error("Distribution step failed, but checking for withdrawable funds...");
        }
      }

      setStep("withdrawing");
      const result = await getUserClaimStatus({
        publicClient,
        questionId,
        addresses: [walletAddress, smartAccountAddress],
        finalAnswer,
        parsed,
      });

      if (result.contractBalance > 0n) {
        await withdraw(publicClient, accountKitClient as any);
        toast.success("Withdrawal successful!");
      } else {
        toast.info("No funds to withdraw yet.");
      }

      setStep("done");
      await refreshStatus();
    } catch (e: unknown) {
      logger.error("Claim/withdraw process error:", e);
      const msg = (e as { message?: string })?.message ?? "Process failed.";
      setError(msg);
      setStep("error");
      toast.error("Failed to complete claim process.");
    }
  };

  const handleWithdrawOnly = async () => {
    if (!isConnected || !walletAddress || !accountKitClient) {
      toast.error("Connect your wallet to withdraw.");
      return;
    }
    setError(null);
    setStep("withdrawing");
    try {
      await withdraw(publicClient, accountKitClient as any);
      toast.success("Withdrawal successful!");
      setStep("done");
      await refreshStatus();
    } catch (e: unknown) {
      logger.error("Withdraw error:", e);
      setError((e as { message?: string })?.message ?? "Withdrawal failed.");
      setStep("error");
      toast.error("Withdrawal failed.");
    }
  };

  if (claimStatus === "not_participant" && isConnected) {
    return null;
  }

  if (claimStatus === "bonded_lost" && isConnected) {
    return (
      <Card className="p-4 bg-muted/40 border-muted">
        <p className="text-sm text-muted-foreground">
          This prediction is resolved. Your bond was on a losing answer.
        </p>
      </Card>
    );
  }

  if (claimStatus === "already_settled" && isConnected) {
    return (
      <Card className="p-4 bg-muted/40 border-muted">
        <p className="text-sm text-muted-foreground">
          Winnings for this market have already been claimed and withdrawn.
        </p>
      </Card>
    );
  }

  const isLoading =
    step === "fetching" || step === "claiming" || step === "withdrawing";
  const hasBalance = contractBalance !== null && contractBalance > 0n;
  const showClaimCta =
    claimStatus === "won_pending_claim" || claimStatus === "won_withdrawable";

  return (
    <Card className="p-6 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
          Claim your winnings
        </h2>
      </div>

      {!isConnected ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Connect your wallet to claim or withdraw.
        </p>
      ) : showClaimCta ? (
        <>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4">
            {claimStatus === "won_pending_claim" ? (
              <>
                You bonded{" "}
                <strong>
                  {Number(formatEther(winningBondTotal)).toFixed(4)} ETH
                </strong>{" "}
                on{" "}
                <strong>{winningAnswerLabel ?? "the winning answer"}</strong>.
                Claim to distribute winnings, then withdraw to your wallet.
              </>
            ) : (
              <>
                You have{" "}
                <strong>
                  {Number(formatEther(contractBalance ?? 0n)).toFixed(4)} ETH
                </strong>{" "}
                ready to withdraw from Reality.eth
                {contractBalance && contractBalance > winningBondTotal
                  ? " (may include other markets)"
                  : ""}
                .
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Button
              type="button"
              onClick={refreshStatus}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="border-emerald-300 dark:border-emerald-700"
            >
              Refresh
            </Button>
            {contractBalance !== null && (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-800 dark:text-emerald-200">
                <Wallet className="h-4 w-4" aria-hidden />
                Withdrawable balance:{" "}
                {Number(formatEther(contractBalance)).toFixed(4)} ETH
              </span>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 mb-4" role="alert">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {claimStatus === "won_pending_claim" && (
              <Button
                type="button"
                onClick={handleClaimAndWithdraw}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Processing…
                  </>
                ) : (
                  "Claim & withdraw"
                )}
              </Button>
            )}
            {hasBalance && claimStatus === "won_withdrawable" && (
              <Button
                type="button"
                onClick={handleWithdrawOnly}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Withdraw
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Checking claim eligibility…
        </p>
      )}
    </Card>
  );
}
