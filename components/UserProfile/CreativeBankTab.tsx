"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Send, ExternalLink, AlertCircle, RefreshCw, Wallet } from 'lucide-react';
import { useSmartAccountClient } from '@account-kit/react';
import { type Address, parseUnits, formatUnits, erc20Abi, encodeFunctionData } from 'viem';
import { BASE_TOKENS } from '@/lib/sdk/alchemy/swap-service';
import { useGasSponsorship } from '@/lib/hooks/wallet/useGasSponsorship';
import { AlchemySwapWidget } from '@/components/wallet/swap/AlchemySwapWidget';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


export function CreativeBankTab() {
    const { address: userAddress, client } = useSmartAccountClient({});
    const { getGasContext } = useGasSponsorship();

    const [destinationAddress, setDestinationAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSwap, setShowSwap] = useState(false);

    // Constants
    const CREATIVE_BANK_URL = "https://bank.creativeplatform.xyz";

    // Fetch USDC Balance
    const fetchBalance = async () => {
        if (!userAddress || !client) return;

        try {
            setIsLoadingBalance(true);
            const balance = await client.readContract({
                address: BASE_TOKENS.USDC as Address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [userAddress as Address],
            });
            setUsdcBalance(balance);
            setIsLoadingBalance(false);
        } catch (err) {
            logger.warn('Failed to fetch USDC balance:', err);
            setIsLoadingBalance(false);
        }
    };

    useEffect(() => {
        fetchBalance();
        const interval = setInterval(fetchBalance, 10000); // 10s polling
        return () => clearInterval(interval);
    }, [userAddress, client]);

    // Provide quick way to fill known address (placeholder for now if needed, but keeping generic as requested)
    // The user said "The address that I want in there will come from Creative Bank", implying manual input or copy-paste from that site.

    const handleSend = async () => {
        if (!userAddress || !client || !destinationAddress || !amount) return;

        setError(null);
        setTxHash(null);
        setIsSending(true);

        try {
            const parsedAmount = parseUnits(amount, 6); // USDC has 6 decimals

            if (parsedAmount > usdcBalance) {
                throw new Error("Insufficient USDC balance");
            }

            // Encode the transfer call
            const data = encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [destinationAddress as Address, parsedAmount]
            });

            // Get Gas Context (assume USDC sponsorship or similar)
            const gasContext = getGasContext('sponsored'); // Or 'usdc' depending on policy. Using 'sponsored' for now as bank transfers might be sponsored.
            // Re-reading user request: "Swaps work just like any other Smart Wallet transaction... sponsor gas... or pay...". 
            // I'll stick to a default context or allow fallback.

            const uoCallData = {
                target: BASE_TOKENS.USDC as Address,
                data: appendBuilderCode(data),
                value: 0n,
            };

            const operation = await client.sendUserOperation({
                uo: uoCallData,
                context: gasContext.context
            });

            logger.debug('UserOp sent:', operation.hash);

            const tx = await client.waitForUserOperationTransaction({
                hash: operation.hash
            });

            setTxHash(tx);
            setAmount(''); // Reset amount on success
            fetchBalance(); // Refresh balance

        } catch (err: any) {
            logger.error('Transfer failed:', err);
            setError(err.message || "Failed to send USDC");
        } finally {
            setIsSending(false);
        }
    };

    const formattedBalance = formatUnits(usdcBalance, 6);

    let isInsufficientBalance = false;
    try {
        if (amount) {
            isInsufficientBalance = parseUnits(amount, 6) > usdcBalance;
        }
    } catch (e) {
        // Ignore parse errors
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-2">
                        <Wallet className="w-6 h-6" />
                        Creative Bank
                    </CardTitle>
                    <CardDescription>
                        Deposit USDC directly to your Creative Bank account.
                        <br />
                        Don't have an account? <a href={CREATIVE_BANK_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">Connect or create one here</a>.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* Balance Display */}
                    <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground">Available Balance</span>
                            <div className="text-2xl font-bold flex items-center gap-1">
                                {isLoadingBalance ? <Loader2 className="h-4 w-4 animate-spin" /> : formattedBalance} USDC
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchBalance} disabled={isLoadingBalance}>
                            <RefreshCw className={`h-4 w-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {/* Transfer Form */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="destination">Bank Recipient Address</Label>
                            <Input
                                id="destination"
                                placeholder="0x..."
                                value={destinationAddress}
                                onChange={(e) => setDestinationAddress(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter the address provided by <a href={CREATIVE_BANK_URL} target="_blank" rel="noreferrer" className="underline">Creative Bank</a>.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (USDC)</Label>
                            <div className="relative">
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="pr-16"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                    USDC
                                </div>
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {txHash && (
                            <Alert className="border-green-500 bg-green-500/10 text-green-700">
                                <ExternalLink className="h-4 w-4" />
                                <AlertTitle>Transfer Successful!</AlertTitle>
                                <AlertDescription>
                                    <a
                                        href={`https://basescan.org/tx/${txHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="underline hover:opacity-80"
                                    >
                                        View on Explorer
                                    </a>
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="pt-2">
                            <Button
                                className="w-full"
                                onClick={handleSend}
                                disabled={!destinationAddress || !amount || isSending || parseFloat(amount || '0') <= 0 || !!(isInsufficientBalance)}
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Deposit to Bank
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Swap Suggestion */}
                        {isInsufficientBalance && (
                            <Alert className="bg-yellow-50 border-yellow-200">
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                                <AlertTitle className="text-yellow-800">Insufficient USDC</AlertTitle>
                                <AlertDescription className="text-yellow-700">
                                    You don't have enough USDC for this deposit.
                                    <div className="mt-2">
                                        <Dialog open={showSwap} onOpenChange={setShowSwap}>
                                            <DialogTrigger asChild>
                                                <Button variant="secondary" className="w-full sm:w-auto">
                                                    Swap Tokens for USDC
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[425px]">
                                                <DialogTitle>Swap to USDC</DialogTitle>
                                                <AlchemySwapWidget
                                                    hideHeader
                                                    defaultToToken="USDC"
                                                    onSwapSuccess={() => {
                                                        fetchBalance();
                                                        setShowSwap(false);
                                                    }}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Always show Swap option as secondary if they want to top up even if not technically insufficient yet? 
                Actually the insufficient alert handles the main case. Maybe add a "Need USDC?" button otherwise.
            */}
                        {!isInsufficientBalance && (
                            <div className="flex justify-center text-sm">
                                <Dialog open={showSwap} onOpenChange={setShowSwap}>
                                    <DialogTrigger asChild>
                                        <Button variant="link" size="sm" className="text-muted-foreground">
                                            Need more USDC? Swap Tokens
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[425px]">
                                        <DialogTitle>Swap to USDC</DialogTitle>
                                        <AlchemySwapWidget
                                            hideHeader
                                            defaultToToken="USDC"
                                            onSwapSuccess={() => {
                                                fetchBalance();
                                                setShowSwap(false);
                                            }}
                                        />
                                    </DialogContent>
                                </Dialog>
                            </div>
                        )}

                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
