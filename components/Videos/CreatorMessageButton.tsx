"use client";

/**
 * meToken-gated creator DM entry point (XMTP).
 * Requires the viewer to hold at least `minBalance` of the creator's meToken.
 */

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthModal, useUser } from "@/lib/wallet/react";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { useXmtpClient } from "@/lib/hooks/xmtp/useXmtpClient";
import { logger } from "@/lib/utils/logger";
import { toast } from "sonner";
import Link from "next/link";
import { formatEther, type Address } from "viem";
import { publicClient } from "@/lib/viem";

const DEFAULT_MIN_BALANCE = Number(
  process.env.NEXT_PUBLIC_CREATOR_DM_METOKEN_MIN || "1"
);

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

interface CreatorMessageButtonProps {
  creatorAddress: string;
  meTokenAddress?: string | null;
  meTokenSymbol?: string | null;
  minBalance?: number;
  className?: string;
}

export function CreatorMessageButton({
  creatorAddress,
  meTokenAddress,
  meTokenSymbol,
  minBalance = DEFAULT_MIN_BALANCE,
  className = "",
}: CreatorMessageButtonProps) {
  const user = useUser();
  const { openAuthModal } = useAuthModal();
  const { address } = useWalletAuth();
  const { client, isLoading: xmtpLoading, error: xmtpError } = useXmtpClient();

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [dmReady, setDmReady] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!meTokenAddress || !address) {
      setBalance(null);
      return;
    }
    setChecking(true);
    setGateError(null);
    try {
      const raw = (await publicClient.readContract({
        address: meTokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as Address],
      })) as bigint;
      setBalance(Number(formatEther(raw)));
    } catch (err) {
      logger.warn("Creator DM balance check failed:", err);
      setGateError(
        err instanceof Error ? err.message : "Balance check failed"
      );
      setBalance(null);
    } finally {
      setChecking(false);
    }
  }, [meTokenAddress, address]);

  useEffect(() => {
    if (open) void fetchBalance();
  }, [open, fetchBalance]);

  const handleOpen = () => {
    if (!user || !address) {
      openAuthModal();
      return;
    }
    if (!meTokenAddress) {
      toast.error("This creator does not have a meToken yet.");
      return;
    }
    setOpen(true);
    setDmReady(false);
  };

  const handleStartDm = async () => {
    if (balance === null || balance < minBalance) {
      setGateError(
        `You need at least ${minBalance} ${meTokenSymbol || "meTokens"} to message this creator.`
      );
      return;
    }
    if (!client) {
      setGateError(
        xmtpError?.message ||
          "XMTP is still connecting. Try again in a moment."
      );
      return;
    }
    try {
      const anyClient = client as any;
      if (typeof anyClient.conversations?.newDm === "function") {
        await anyClient.conversations.newDm(creatorAddress);
      } else if (typeof anyClient.conversations?.createDm === "function") {
        await anyClient.conversations.createDm(creatorAddress);
      } else if (typeof anyClient.conversations?.newConversation === "function") {
        await anyClient.conversations.newConversation(creatorAddress);
      } else {
        throw new Error("XMTP DM API not available in this SDK build");
      }
      setDmReady(true);
      toast.success("Direct message ready");
    } catch (err) {
      logger.error("Failed to open XMTP DM:", err);
      setGateError(
        err instanceof Error ? err.message : "Failed to start direct message"
      );
    }
  };

  const hasAccess = balance !== null && balance >= minBalance;

  return (
    <>
      <Button
        variant="ghost"
        className={`cursor-pointer hover:scale-105 transition-all px-3 py-2 h-auto ${className}`}
        aria-label="Message creator"
        onClick={handleOpen}
      >
        <MessageCircle className="w-5 h-5 mr-1.5" />
        <span className="text-sm font-medium">Message</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Message creator</DialogTitle>
            <DialogDescription>
              Hold at least {minBalance}{" "}
              {meTokenSymbol || "meTokens"} to start a private XMTP conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {checking || xmtpLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking access…
              </div>
            ) : (
              <>
                <p>
                  Your balance:{" "}
                  <span className="font-medium">
                    {balance === null
                      ? "—"
                      : `${balance} ${meTokenSymbol || "tokens"}`}
                  </span>
                </p>
                {!hasAccess && meTokenAddress && (
                  <p className="text-amber-600 dark:text-amber-400">
                    Not enough tokens yet.{" "}
                    <Link
                      href={`/profile/${creatorAddress}`}
                      className="underline"
                    >
                      Buy {meTokenSymbol || "meTokens"}
                    </Link>{" "}
                    to unlock messaging.
                  </p>
                )}
                {gateError && (
                  <p className="text-destructive text-xs">{gateError}</p>
                )}
                {dmReady && (
                  <p className="text-green-600 dark:text-green-400">
                    DM conversation created. Open your XMTP inbox to continue.
                  </p>
                )}
              </>
            )}

            <Button
              className="w-full"
              disabled={!hasAccess || checking || xmtpLoading || dmReady}
              onClick={() => void handleStartDm()}
            >
              {dmReady ? "DM ready" : "Start direct message"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
