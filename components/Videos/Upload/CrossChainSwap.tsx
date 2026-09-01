"use client";

import React, { useState } from "react";
import {
    useSmartAccountClient,
    usePrepareSwap,
    useSignAndSendPreparedCalls,
    useWaitForCallsStatus,
    useUser,
} from "@/lib/wallet/react";
import { getEthBalance } from "@/lib/viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ArrowRightLeft, CheckCircle, Wallet } from "lucide-react";
import { toHex, parseEther, formatEther, type Address } from "viem";
import { logger } from '@/lib/utils/logger';


/**
 * Supported Chain IDs
 */
const CHAIN_IDS = {
    BASE: 8453, // 0x2105
    STORY_TESTNET: 1315, // 0x523
    STORY_MAINNET: 1514, // 0x5EA
} as const;

/**
 * Token Addresses
 * NATIVE: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee (ETH on Base or IP token on Story)
 */
const TOKENS = {
    NATIVE: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee", // ETH on Base, IP token on Story
} as const;

interface CrossChainSwapProps {
    onSwapSuccess?: () => void;
    requiredAmount?: string; // Optional amount hint
    recipientAddress?: string; // Optional custom recipient
}

export function CrossChainSwap({ onSwapSuccess, requiredAmount, recipientAddress: propRecipientAddress }: CrossChainSwapProps) {
    const user = useUser();
    const { client } = useSmartAccountClient({});
    const [error, setError] = useState<string | null>(null);
    const [quote, setQuote] = useState<any>(null); // TODO: Type properly from SDK if available
    const [ethBalance, setEthBalance] = useState<string | null>(null);
    const [isCheckingBalance, setIsCheckingBalance] = useState(false);

    // Get current Story Network from env or default to testnet
    const isMainnet = process.env.NEXT_PUBLIC_STORY_NETWORK === "mainnet";
    const targetChainId = isMainnet
        ? CHAIN_IDS.STORY_MAINNET
        : CHAIN_IDS.STORY_TESTNET;

    // Always swap to native IP token on Story Protocol
    const storyTokenAddress = TOKENS.NATIVE;

    // 1. Prepare Swap Hook
    const { prepareSwapAsync, isPreparingSwap } = usePrepareSwap({
        client,
    });

    // 2. Sign and Send Hook
    const {
        signAndSendPreparedCallsAsync,
        isSigningAndSendingPreparedCalls,
        signAndSendPreparedCallsResult,
    } = useSignAndSendPreparedCalls({ client });

    // 3. Wait for Status Hook
    const {
        data: statusResult,
        isLoading: isWaitingForConfirmation,
        error: waitError,
    } = useWaitForCallsStatus({
        client,
        id: signAndSendPreparedCallsResult?.preparedCallIds[0],
    });

    // Fetch ETH balance
    const fetchEthBalance = React.useCallback(async () => {
        const addr = client?.account?.address ?? client?.scaAddress;
        if (!addr) {
            setEthBalance(null);
            return;
        }

        try {
            const balance = await getEthBalance(addr);
            setEthBalance(formatEther(balance));
        } catch (err) {
            logger.error("Error fetching ETH balance:", err);
            setEthBalance(null);
        }
    }, [client?.scaAddress, client?.account?.address]);

    // Fetch balance on mount and when address changes
    React.useEffect(() => {
        fetchEthBalance();
    }, [fetchEthBalance]);

    const handleRequestQuote = async () => {
        const addr = client?.account?.address ?? client?.scaAddress;
        if (!addr) return;
        setError(null);
        setQuote(null);
        setIsCheckingBalance(true);

        let balanceFormatted: string | null = null;

        try {
            // First, check ETH balance
            const balance = await getEthBalance(addr);

            balanceFormatted = formatEther(balance);
            setEthBalance(balanceFormatted);

            // Use requiredAmount if provided, otherwise default to 0.001 ETH
            const defaultAmount = "0.001"; // 0.001 ETH
            const amountStr = requiredAmount || defaultAmount;
            const amountToSwapBigInt = parseEther(amountStr);

            // Check if balance is sufficient
            if (balance < amountToSwapBigInt) {
                const errorMsg = `Insufficient ETH balance. You have ${balanceFormatted} ETH, but need ${amountStr} ETH for this swap.`;
                setError(errorMsg);
                setIsCheckingBalance(false);
                return;
            }

            const amountToSwap = toHex(amountToSwapBigInt);
            const paymasterPolicyId = process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID;

            // Determine recipient address priority: Prop > Env Var > Client Address
            const storyFundingWallet = process.env.NEXT_PUBLIC_STORY_FUNDING_WALLET_ADDRESS;
            const targetRecipient = propRecipientAddress || storyFundingWallet || addr;

            const swapParams: any = {
                from: addr,
                fromToken: TOKENS.NATIVE, // ETH on Base (native token)
                toChainId: toHex(targetChainId),
                toToken: storyTokenAddress, // Native IP token on Story Protocol
                fromAmount: amountToSwap,
                ...(paymasterPolicyId && {
                    capabilities: {
                        paymasterService: {
                            policyId: paymasterPolicyId,
                        },
                    },
                }),
            };

            // If target recipient is different from sender, try to use it
            if (targetRecipient && targetRecipient.toLowerCase() !== addr.toLowerCase()) {
                logger.debug("🎯 Using custom recipient address for swap:", targetRecipient);
                // Try standard 'to' parameter (API specific support)
                swapParams.to = targetRecipient;
            }

            const result = await prepareSwapAsync(swapParams) as {
                quote: { minimumToAmount?: string | bigint };
                [key: string]: unknown;
            } | null | undefined;

            if (!result) {
                throw new Error("Failed to prepare swap: no result returned");
            }

            const { quote: swapQuote, ...calls } = result;

            logger.debug("🔍 Full swap quote response:", {
                quote: swapQuote,
                recipient: targetRecipient,
                fullResult: result,
            });

            if (swapQuote.minimumToAmount) {
                const rawAmount =
                    typeof swapQuote.minimumToAmount === "bigint"
                        ? swapQuote.minimumToAmount
                        : BigInt(swapQuote.minimumToAmount);
                const formattedAmount = formatEther(rawAmount);
                const ipAmount = parseFloat(formattedAmount);

                // Warn if the quote seems unreasonably low
                if (ipAmount < 0.01) {
                    const expectedAmount = parseFloat(amountStr) * 500; // Conservative estimate
                    logger.warn(`⚠️ Quote seems very low! Expected ~${expectedAmount.toFixed(2)} IP for ${amountStr} ETH, got:`, formattedAmount);
                }

                // If the amount is actually zero, this route doesn't exist
                if (rawAmount === 0n) {
                    logger.error("❌ Quote returned ZERO - This swap route does not exist!");
                }
            }

            setQuote({ quote: swapQuote, calls });

        } catch (err) {
            logger.error("Swap quote error:", err);
            let errorMessage = "Failed to get swap quote";

            if (err instanceof Error) {
                if (err.message.includes("transfer amount exceeds balance") ||
                    err.message.includes("insufficient funds")) {
                    const currentBalance = balanceFormatted || ethBalance || "0";
                    const defaultAmount = requiredAmount || "0.001";
                    errorMessage = `Insufficient ETH balance. You have ${currentBalance} ETH, but need ${defaultAmount} ETH for this swap.`;
                } else if (err.message.includes("status 500") || err.message.includes("500")) {
                    if (!isMainnet) {
                        errorMessage = `Cross-chain swap to Story Testnet may not be available. The swap API returned an error.`;
                    } else {
                        errorMessage = `Swap API error. The cross-chain swap route may not be available.`;
                    }
                } else {
                    errorMessage = err.message;
                }
            }

            setError(errorMessage);
        } finally {
            setIsCheckingBalance(false);
        }
    };

    const handleExecuteSwap = async () => {
        if (!quote || !quote.calls) return;

        try {
            await signAndSendPreparedCallsAsync(quote.calls);
        } catch (err) {
            logger.error("Swap execution error:", err);
            setError(err instanceof Error ? err.message : "Failed to execute swap");
        }
    };

    // Status Helpers
    const isSwapSuccessful = statusResult?.statusCode === 200;
    const isCrossChainPending = statusResult?.statusCode === 120 || (isWaitingForConfirmation && !isSwapSuccessful);

    React.useEffect(() => {
        if (isSwapSuccessful) {
            fetchEthBalance();
            if (onSwapSuccess) {
                onSwapSuccess();
            }
        }
    }, [isSwapSuccessful, onSwapSuccess, fetchEthBalance]);

    if (!user) {
        return <div className="text-sm text-center p-4">Please connect wallet to swap.</div>;
    }

    // Determine which address gets the funds for display text
    const storyFundingWallet = process.env.NEXT_PUBLIC_STORY_FUNDING_WALLET_ADDRESS;
    const clientAddr = client?.account?.address ?? client?.scaAddress;
    const targetRecipient = propRecipientAddress || storyFundingWallet || clientAddr;
    const isUsingFundingWallet =
        targetRecipient && clientAddr && targetRecipient.toLowerCase() !== clientAddr.toLowerCase();

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    Fund Story Wallet
                </CardTitle>
                <CardDescription>
                    Swap ETH from Base to $IP on Story Protocol{!isMainnet ? " (Testnet)" : ""}.
                    {isUsingFundingWallet && (
                        <span className="block mt-1 text-xs text-muted-foreground font-medium text-green-600 dark:text-green-400">
                            Funds will be sent directly to the gas wallet to pay for your minting.
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Display ETH Balance */}
                {ethBalance !== null && (
                    <div className="bg-muted/50 border rounded-md p-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Your ETH Balance (Base):</span>
                            <span className="font-semibold text-foreground">{ethBalance} ETH</span>
                        </div>
                    </div>
                )}
                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {waitError && (
                    <Alert variant="destructive">
                        <AlertTitle>Transaction Error</AlertTitle>
                        <AlertDescription>{waitError instanceof Error ? waitError.message : "Unknown error"}</AlertDescription>
                    </Alert>
                )}

                {!quote && !signAndSendPreparedCallsResult && (
                    <Button
                        onClick={handleRequestQuote}
                        disabled={isPreparingSwap || isCheckingBalance}
                        className="w-full"
                        variant="secondary"
                    >
                        {isPreparingSwap || isCheckingBalance ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isCheckingBalance ? "Checking Balance..." : "Getting Quote..."}
                            </>
                        ) : (
                            <>
                                Get Quote (0.001 ETH)
                            </>
                        )}
                    </Button>
                )}

                {quote && !signAndSendPreparedCallsResult && (
                    <div className="space-y-3">
                        <div className="bg-card border p-3 rounded-md text-sm">
                            <div className="flex justify-between mb-1">
                                <span className="text-muted-foreground">Pay (Base):</span>
                                <span className="font-medium text-foreground">
                                    {requiredAmount ? `${requiredAmount} ETH` : "0.001 ETH"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Receive (Story):</span>
                                <span className="font-medium text-foreground">
                                    {quote.quote.minimumToAmount ? (() => {
                                        try {
                                            const amount = typeof quote.quote.minimumToAmount === 'string'
                                                ? quote.quote.minimumToAmount.startsWith('0x')
                                                    ? BigInt(quote.quote.minimumToAmount)
                                                    : BigInt(quote.quote.minimumToAmount)
                                                : BigInt(quote.quote.minimumToAmount);
                                            const formatted = formatEther(amount);
                                            const numFormatted = parseFloat(formatted);
                                            return `~${numFormatted.toFixed(6)} IP`;
                                        } catch (e) {
                                            return "Calculated at execution";
                                        }
                                    })() : "Calculated at execution"}
                                </span>
                            </div>
                        </div>

                        {/* Warning if quote seems unreasonably low or zero */}
                        {quote.quote.minimumToAmount && (() => {
                            try {
                                const amount = typeof quote.quote.minimumToAmount === 'string'
                                    ? quote.quote.minimumToAmount.startsWith('0x')
                                        ? BigInt(quote.quote.minimumToAmount)
                                        : BigInt(quote.quote.minimumToAmount)
                                    : BigInt(quote.quote.minimumToAmount);

                                if (amount === 0n) {
                                    return (
                                        <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                                            <AlertTitle className="text-red-800 dark:text-red-200">Route Not Available</AlertTitle>
                                            <AlertDescription className="text-xs text-red-800 dark:text-red-200">
                                                ❌ The cross-chain swap route ETH (Base) → IP (Story) is not available.
                                            </AlertDescription>
                                        </Alert>
                                    );
                                }
                            } catch (e) {
                                return null;
                            }
                            return null;
                        })()}

                        <Button
                            onClick={handleExecuteSwap}
                            disabled={isSigningAndSendingPreparedCalls}
                            className="w-full"
                        >
                            {isSigningAndSendingPreparedCalls ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Swapping...
                                </>
                            ) : (
                                <>
                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                    Confirm Swap
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {signAndSendPreparedCallsResult && (
                    <div className="bg-muted/50 border rounded-md p-4 text-center">
                        {isSwapSuccessful ? (
                            <div className="flex flex-col items-center gap-2 text-green-600 dark:text-green-400">
                                <CheckCircle className="h-8 w-8" />
                                <p className="font-semibold">Swap Complete!</p>
                                <p className="text-sm text-muted-foreground mr-1">
                                    {isUsingFundingWallet
                                        ? "Funds sent to gas wallet."
                                        : "Your Balance has been funded."}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-primary">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <p className="font-semibold">
                                    {isCrossChainPending ? "Cross-Chain Swap in Progress..." : "Processing..."}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    This may take a few minutes.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
