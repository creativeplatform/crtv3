"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSmartAccountClient, useUser, useAuthModal } from "@account-kit/react";
import { getBuyArgs, getSellArgs, getQuote } from "@/app/actions/paragraph";
import { parseEther, encodeFunctionData, parseAbi, formatEther } from "viem";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/utils";
import Image from "next/image";
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


const DEARCRTV_ADDRESS = "0x81ced3c6e7058c1fe8d9b6c5a2435a65a4593292";
const UNIVERSAL_ROUTER_ADDRESS = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";

const universalRouterAbi = parseAbi([
    'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable',
]);

export function DearCreativeTradeButton() {
    const user = useUser();
    const { openAuthModal } = useAuthModal();
    const { client } = useSmartAccountClient({});

    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'buy' | 'sell'>('buy');

    const [amount, setAmount] = useState("0.001");
    const [quote, setQuote] = useState<string | null>(null);
    const [isQuoting, setIsQuoting] = useState(false);
    const [tokenImage, setTokenImage] = useState<string | null>(null);

    // Fetch Token Metadata
    useEffect(() => {
        const fetchTokenMetadata = async () => {
            try {
                const response = await fetch(`https://public.api.paragraph.com/api/v1/coins/contract/${DEARCRTV_ADDRESS}`);
                if (response.ok) {
                    const data = await response.json();
                    // The API returns the image in metadata.image or metadata.logoURI
                    if (data?.metadata?.image || data?.metadata?.logoURI) {
                        setTokenImage(data.metadata.image || data.metadata.logoURI);
                    }
                }
            } catch (error) {
                logger.error("Failed to fetch token metadata:", error);
            }
        };

        fetchTokenMetadata();
    }, []);

    // Debounced Quote Fetching
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(async () => {
            if (!amount || parseFloat(amount) <= 0) {
                setQuote(null);
                return;
            }

            try {
                setIsQuoting(true);
                const amountWei = parseEther(amount);
                const quoteWei = await getQuote(DEARCRTV_ADDRESS, amountWei.toString(), mode);

                if (quoteWei) {
                    const estimatedValue = formatEther(BigInt(quoteWei));
                    setQuote(parseFloat(estimatedValue).toFixed(6));
                } else {
                    setQuote(null);
                }
            } catch (error) {
                logger.error("Failed to get quote:", error);
                setQuote(null);
            } finally {
                setIsQuoting(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [amount, mode, isOpen]);

    const handleTrade = async () => {
        if (!user || !client || !client.account) {
            toast.error("Please connect your wallet first");
            if (openAuthModal) openAuthModal();
            return;
        }

        try {
            setIsLoading(true);
            const amountWei = parseEther(amount);

            let args;
            if (mode === 'buy') {
                args = await getBuyArgs(DEARCRTV_ADDRESS, client.account.address, amountWei.toString());
            } else {
                args = await getSellArgs(DEARCRTV_ADDRESS, client.account.address, amountWei.toString());
            }

            if (!args) {
                throw new Error(`Failed to get ${mode} arguments`);
            }

            // Execute via Universal Router
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 mins

            const data = encodeFunctionData({
                abi: universalRouterAbi,
                functionName: "execute",
                args: [args.commands, args.inputs, deadline]
            });

            // For SELL: value should be 0 (tokens are approved/transferred)
            // For BUY: value should be amountWei (sending ETH)
            const txValue = mode === 'buy' ? amountWei : BigInt(0);

            const result = await client.sendUserOperation({
                uo: {
                    target: UNIVERSAL_ROUTER_ADDRESS,
                    data: appendBuilderCode(data),
                    value: txValue,
                }
            });

            const txHash = await client.waitForUserOperationTransaction({
                hash: result.hash,
            });

            toast.success(`${mode === 'buy' ? 'Purchase' : 'Sale'} successful!`, {
                action: {
                    label: "View on BaseScan",
                    onClick: () => window.open(`https://basescan.org/tx/${txHash}`, "_blank")
                }
            });
            setIsOpen(false);

        } catch (error) {
            logger.error("Trade failed:", error);
            toast.error(`Failed to ${mode}: ` + (error as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Button
                onClick={() => {
                    if (!user) {
                        try {
                            if (openAuthModal) openAuthModal();
                            else logger.error("openAuthModal is not defined in useAuthModal()");
                        } catch (err) {
                            logger.error("Error opening auth modal:", err);
                        }
                        return;
                    }
                    setIsOpen(true);
                }}
                className="font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
                {tokenImage ? (
                    <div className="relative w-5 h-5 rounded-full overflow-hidden">
                        <Image
                            src={tokenImage}
                            alt="$DEARCRTV"
                            fill
                            className="object-cover"
                        />
                    </div>
                ) : (
                    <ArrowRightLeft className="w-4 h-4" />
                )}
                Trade $DEARCRTV
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                {user && (
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                {tokenImage && (
                                    <div className="relative w-6 h-6 rounded-full overflow-hidden">
                                        <Image
                                            src={tokenImage}
                                            alt="$DEARCRTV"
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                )}
                                Trade $DEARCRTV
                            </DialogTitle>
                            <DialogDescription>
                                Buy or Sell $DEARCRTV tokens instantly.
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs value={mode} onValueChange={(v) => setMode(v as 'buy' | 'sell')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="buy">Buy</TabsTrigger>
                                <TabsTrigger value="sell">Sell</TabsTrigger>
                            </TabsList>

                            <div className="py-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amount">
                                        {mode === 'buy' ? 'ETH Amount to Pay' : 'DEARCRTV Amount to Sell'}
                                    </Label>
                                    <Input
                                        id="amount"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        type="number"
                                        step="0.0001"
                                        min="0"
                                        placeholder="0.00"
                                    />
                                </div>

                                {/* Quote Display */}
                                <div className="flex items-center justify-between text-sm bg-muted/50 p-3 rounded-md">
                                    <span className="text-muted-foreground">
                                        {mode === 'buy' ? 'You Receive:' : 'You Receive:'}
                                    </span>
                                    <span className="font-bold flex items-center">
                                        {isQuoting && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                                        {!isQuoting && quote ? (
                                            <>
                                                {quote} {mode === 'buy' ? '$DEARCRTV' : 'ETH'}
                                            </>
                                        ) : (
                                            '-'
                                        )}
                                    </span>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button
                                    onClick={handleTrade}
                                    disabled={isLoading || isQuoting || !quote || parseFloat(amount || "0") <= 0}
                                    className={cn(
                                        "w-full",
                                        mode === 'buy'
                                            ? "bg-green-600 hover:bg-green-700 text-white"
                                            : "bg-red-600 hover:bg-red-700 text-white"
                                    )}
                                >
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isLoading
                                        ? "Processing..."
                                        : `${mode === 'buy' ? 'Buy' : 'Sell'} ${mode === 'buy' ? '$DEARCRTV' : 'ETH'}`
                                    }
                                </Button>
                            </DialogFooter>
                        </Tabs>
                    </DialogContent>
                )}
            </Dialog>
        </>
    );
}
