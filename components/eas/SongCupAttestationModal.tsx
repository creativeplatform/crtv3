"use client";

import { useState } from "react";
import { formatEther, formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useSongCupAttestation } from "@/lib/hooks/eas/useSongCupAttestation";
import CoinbaseFundButton from "@/components/wallet/buy/coinbase-fund-button";
import {
  SONG_CUP_ATTESTATION_CERTIFICATION,
  SONG_CUP_ATTESTATION_TERMS_SECTIONS,
} from "@/lib/songchain/song-cup/copy";
import {
  SONG_CUP_ATTESTATION_TERMS_URL,
  SONG_CUP_ATTESTATION_TERMS_VERSION,
} from "@/lib/songchain/song-cup/attestation-config";
import { logger } from "@/lib/utils/logger";

interface SongCupAttestationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: () => void;
}

export function SongCupAttestationModal({
  open,
  onOpenChange,
  onVerified,
}: SongCupAttestationModalProps) {
  const {
    status,
    error,
    signAttestation,
    isAttested,
    isLoading,
    gasRequirement,
    needsGas,
    clearGasRequirement,
  } = useSongCupAttestation();
  const [confirmed, setConfirmed] = useState(false);

  const handleSign = async () => {
    if (!confirmed) return;
    const result = await signAttestation();
    if (result) {
      logger.debug("Song Cup attestation verified:", result.uid);
      onVerified?.();
      setTimeout(() => onOpenChange(false), 1500);
    }
  };

  const renderBody = () => {
    if (isAttested) {
      return (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-semibold">Terms Attestation Confirmed</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your Song Cup contest terms attestation is on-chain. You can now submit your entry.
          </p>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Continue to Submit
          </Button>
        </div>
      );
    }

    if (needsGas && gasRequirement) {
      const hasNoTokens = gasRequirement.ethBalance === 0n && gasRequirement.usdcBalance === 0n;

      return (
        <div className="flex flex-col gap-4 py-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-amber-100 p-4 dark:bg-amber-900/30">
              <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-xl font-semibold">Gas Required</h3>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/50 p-4 text-left text-sm">
            <p>
              {hasNoTokens
                ? "Your smart account has no ETH or USDC. You need one of these gas tokens on Base to submit the attestation."
                : `Your smart account does not have enough gas. You currently have ${Number(formatEther(gasRequirement.ethBalance)).toFixed(6)} ETH and ${Number(formatUnits(gasRequirement.usdcBalance, 6)).toFixed(2)} USDC.`}
            </p>
            <div>
              <p className="font-medium">Smart account address:</p>
              <code className="mt-1 block break-all text-xs text-muted-foreground">
                {gasRequirement.scaAddress}
              </code>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <CoinbaseFundButton presetAmount={50} onClose={clearGasRequirement} className="w-full" />
            <Button variant="outline" onClick={clearGasRequirement} className="w-full">
              I&apos;ve added gas — try again
            </Button>
          </div>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <h3 className="text-xl font-semibold">Attestation Failed</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {error || "Something went wrong while confirming your attestation."}
          </p>
          <Button onClick={handleSign} variant="outline" className="w-full sm:w-auto">
            Try Again
          </Button>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <h3 className="text-lg font-semibold">
            {status === "checking" && "Checking attestation..."}
            {status === "signing" && "Signing attestation..."}
            {status === "submitting" && "Submitting to Base..."}
          </h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {status === "checking"
              ? "Checking whether you've already signed the Song Cup contest terms."
              : "Please confirm the transaction in your wallet. Gas is sponsored by Creative TV."}
          </p>
        </div>
      );
    }

    return (
      <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
        <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
          {SONG_CUP_ATTESTATION_TERMS_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <p className="text-sm font-semibold">{section.title}</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Song Cup Contest Terms</p>
            <p className="text-xs text-muted-foreground">Version {SONG_CUP_ATTESTATION_TERMS_VERSION}</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a
              href={SONG_CUP_ATTESTATION_TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              View on site
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="song-cup-terms"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="song-cup-terms" className="cursor-pointer text-sm font-medium">
              I certify and attest
            </Label>
            <p className="text-xs text-muted-foreground">{SONG_CUP_ATTESTATION_CERTIFICATION}</p>
          </div>
        </div>

        <Button onClick={handleSign} disabled={!confirmed} className="w-full">
          <ShieldCheck className="mr-2 h-4 w-4" />
          Sign Song Cup Terms Attestation
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Song Cup Terms &amp; Conditions
          </DialogTitle>
          <DialogDescription>
            Sign an on-chain attestation confirming you meet all Song Cup contest requirements before
            submitting your entry.
          </DialogDescription>
        </DialogHeader>
        {renderBody()}
      </DialogContent>
    </Dialog>
  );
}
