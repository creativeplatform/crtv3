"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMeTokensSupabase } from "@/lib/hooks/metokens/useMeTokensSupabase";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { useMeTokenPurchase } from "@/lib/hooks/metokens/useMeTokenPurchase";
import { Loader2, Lock, Coins, AlertCircle } from "lucide-react";
import { formatEther, parseEther, type Address } from "viem";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VideoMeTokenBuyDialog } from "@/components/Videos/VideoMeTokenBuyDialog";
import { Separator } from "@/components/ui/separator";
import { logger } from '@/lib/utils/logger';
import { getErc20Balance } from '@/lib/viem';


interface VideoPurchaseDialogProps {
    videoId: number;
    playbackId: string;
    videoTitle: string;
    price: string; // Price in MeTokens (e.g. "100")
    meTokenAddress: string;
    creatorAddress: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function VideoPurchaseDialog({
    videoId,
    playbackId,
    videoTitle,
    price,
    meTokenAddress,
    creatorAddress,
    open,
    onOpenChange,
    onSuccess
}: VideoPurchaseDialogProps) {
    // We need a way to get the user's balance of *this* specific metoken. 
    // We'll rely on a manual check.

    const [balance, setBalance] = useState<string>("0");
    const [checkingBalance, setCheckingBalance] = useState(false);
    const [showTopUp, setShowTopUp] = useState(false);

    const { purchaseVideo, isPending: isPurchasePending, isConfirming: isPurchaseConfirming } = useMeTokenPurchase();

    // Temporary fix: fetch balance directly since useMeTokensSupabase is designed for "My Creator Token"
    const { client } = useSmartAccountClient({});
    const { userMeToken: _userMeToken } = useMeTokensSupabase(); // Keep the hook for other needs if any, or remove if unused

    useEffect(() => {
        if (open && client && meTokenAddress) {
            checkBalance();
        }
    }, [open, client, meTokenAddress]);

    const checkBalance = async () => {
        if (!client) return;
        setCheckingBalance(true);
        try {
            const bal = await getErc20Balance({
                token: meTokenAddress as Address,
                owner: client.account?.address as Address,
            });
            setBalance(formatEther(bal));
        } catch (e) {
            logger.error("Failed to check balance", e);
        } finally {
            setCheckingBalance(false);
        }
    };

    const hasInsufficientBalance = parseFloat(balance) < parseFloat(price);
    const deficit = parseFloat(price) - parseFloat(balance);

    const handlePurchase = async () => {
        try {
            await purchaseVideo(videoId, price, meTokenAddress, creatorAddress);
            onSuccess?.();
            onOpenChange(false);
        } catch (e) {
            // Error handled in hook
        }
    };

    if (showTopUp) {
        return (
            <VideoMeTokenBuyDialog
                open={true}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setShowTopUp(false);
                        checkBalance(); // Refresh balance after top up closes
                    }
                }}
                playbackId={playbackId}
                videoTitle={videoTitle}
            />
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Unlock Video</DialogTitle>
                    <DialogDescription>
                        This video requires <strong>{price} MeTokens</strong> to watch.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Your Balance</span>
                        {checkingBalance ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <span className={`font-medium ${hasInsufficientBalance ? "text-red-500" : "text-green-500"}`}>
                                {parseFloat(balance).toFixed(2)} TKN
                            </span>
                        )}
                    </div>

                    {hasInsufficientBalance && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                You need {deficit.toFixed(2)} more tokens.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex flex-col gap-2">
                        {hasInsufficientBalance ? (
                            <>
                                <Button onClick={() => setShowTopUp(true)} className="w-full">
                                    <Coins className="mr-2 h-4 w-4" />
                                    Buy MeTokens
                                </Button>
                                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            </>
                        ) : (
                            <Button
                                onClick={handlePurchase}
                                disabled={isPurchasePending || isPurchaseConfirming}
                                className="w-full"
                            >
                                {isPurchasePending || isPurchaseConfirming ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Lock className="mr-2 h-4 w-4" />
                                )}
                                {isPurchasePending ? "Processing..." : "Unlock Access"}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
