"use client";

import { useState } from "react";
import { Lock, PenLine, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/lib/wallet/react";
import { VideoMeTokenBuyDialog } from "@/components/Videos/VideoMeTokenBuyDialog";

export interface LiveStreamGateInfo {
  code?: string;
  connectWallet?: boolean;
  signingRequired?: boolean;
  message?: string;
  meTokenAddress?: string;
  symbol?: string;
  required?: string;
  balance?: string;
  creatorAddress?: string;
  streamName?: string | null;
}

interface LiveStreamMeTokenGateProps {
  gate: LiveStreamGateInfo;
  playbackId: string;
  streamTitle?: string | null;
  thumbnailUrl?: string | null;
  onAccessGranted?: () => void;
}

export function LiveStreamMeTokenGate({
  gate,
  playbackId,
  streamTitle,
  thumbnailUrl,
  onAccessGranted,
}: LiveStreamMeTokenGateProps) {
  const { openAuthModal } = useAuthModal();
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);

  const symbol = gate.symbol ?? "MeToken";
  const required = gate.required ?? "0";
  const balance = gate.balance ?? "0";
  const needsWallet = Boolean(gate.connectWallet);
  const needsSignature = Boolean(gate.signingRequired);

  return (
    <>
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden flex flex-col items-center justify-center relative">
        {thumbnailUrl && (
          <div className="absolute inset-0 z-0 opacity-40">
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="z-10 flex flex-col items-center gap-3 p-6 bg-black/70 rounded-xl backdrop-blur-sm text-center max-w-md">
          <Lock className="h-10 w-10 text-amber-400" />
          <h3 className="text-xl font-bold text-white">
            {streamTitle || "Live Stream"} is MeToken-gated
          </h3>
          <p className="text-gray-300 text-sm">
            Hold at least <span className="font-semibold text-white">{required} {symbol}</span> to
            watch this live stream.
          </p>
          {gate.message && (
            <p className="text-xs text-amber-200/90">{gate.message}</p>
          )}
          {!needsWallet && !needsSignature && (
            <p className="text-xs text-gray-400">
              Your balance: {balance} {symbol}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            {needsWallet ? (
              <Button onClick={() => openAuthModal()}>
                <Wallet className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            ) : needsSignature ? (
              <Button onClick={() => onAccessGranted?.()}>
                <PenLine className="h-4 w-4 mr-2" />
                Approve Signature
              </Button>
            ) : (
              <Button onClick={() => setBuyDialogOpen(true)}>
                Buy {symbol}
              </Button>
            )}
          </div>
        </div>
      </div>

      {gate.creatorAddress && (
        <VideoMeTokenBuyDialog
          open={buyDialogOpen}
          onOpenChange={(open) => {
            setBuyDialogOpen(open);
            if (!open) {
              onAccessGranted?.();
            }
          }}
          playbackId={playbackId}
          videoTitle={streamTitle ?? undefined}
          creatorAddress={gate.creatorAddress}
        />
      )}
    </>
  );
}
