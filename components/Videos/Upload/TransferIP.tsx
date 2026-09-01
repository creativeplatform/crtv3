"use client";

import React, { useState, useEffect } from "react";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { createStoryPublicClient } from "@/lib/sdk/story/client";
import { formatEther, parseEther, type Address } from "viem";
import { toast } from "sonner";
import { logger } from '@/lib/utils/logger';


interface TransferIPProps {
  onTransferSuccess?: () => void;
}

export function TransferIP({ onTransferSuccess }: TransferIPProps) {
  const { client } = useSmartAccountClient({});
  const [recipientAddress, setRecipientAddress] = useState("");
  const [fundingWalletAddress, setFundingWalletAddress] = useState<string | null>(null);
  const [fundingWalletBalance, setFundingWalletBalance] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [ipBalance, setIpBalance] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [isLoadingFundingWallet, setIsLoadingFundingWallet] = useState(false);

  // Get current Story Network from env
  const network = process.env.NEXT_PUBLIC_STORY_NETWORK || "testnet";
  const isMainnet = network === "mainnet";
  const explorerUrl = isMainnet 
    ? "https://www.storyscan.io/tx/" 
    : "https://aeneid.storyscan.io/tx/";

  // Fetch funding wallet address on mount
  useEffect(() => {
    const fetchFundingWallet = async () => {
      setIsLoadingFundingWallet(true);
      try {
        const response = await fetch("/api/story/funding-wallet");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.address) {
            setFundingWalletAddress(data.address);
            setRecipientAddress(data.address); // Auto-fill the recipient address
            
            // Also fetch the funding wallet's balance
            const publicClient = createStoryPublicClient();
            const balance = await publicClient.getBalance({
              address: data.address as Address,
            });
            setFundingWalletBalance(formatEther(balance));
          }
        }
      } catch (err) {
        logger.error("Error fetching funding wallet:", err);
      } finally {
        setIsLoadingFundingWallet(false);
      }
    };

    fetchFundingWallet();
  }, []);

  // Fetch IP balance
  const checkBalance = React.useCallback(async () => {
    if (!client?.account?.address) return;

    setIsCheckingBalance(true);
    try {
      const publicClient = createStoryPublicClient();
      const balance = await publicClient.getBalance({
        address: client.account.address as Address,
      });
      
      const formatted = formatEther(balance);
      setIpBalance(formatted);
      logger.debug("✅ IP Balance checked:", {
        address: client.account.address,
        balance: formatted,
        rawBalance: balance.toString(),
      });
    } catch (err) {
      logger.error("Error checking IP balance:", err);
      setError(err instanceof Error ? err.message : "Failed to check balance");
    } finally {
      setIsCheckingBalance(false);
    }
  }, [client?.account?.address]);

  useEffect(() => {
    if (client?.account?.address) {
      checkBalance();
    }
  }, [client?.account?.address, checkBalance]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTxHash(null);

    if (!client?.account?.address) {
      setError("Wallet not connected");
      return;
    }

    if (!recipientAddress || !amount) {
      setError("Please enter recipient address and amount");
      return;
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      setError("Invalid recipient address format");
      return;
    }

    // Validate amount
    let amountWei: bigint;
    try {
      amountWei = parseEther(amount);
      if (amountWei <= 0n) {
        setError("Amount must be greater than 0");
        return;
      }
    } catch (err) {
      setError("Invalid amount format");
      return;
    }

    // Check balance
    if (ipBalance) {
      const balanceWei = parseEther(ipBalance);
      if (amountWei > balanceWei) {
        setError(`Insufficient balance. You have ${ipBalance} IP, but trying to send ${amount} IP`);
        return;
      }
    }

    setIsTransferring(true);

    try {
      const response = await fetch("/api/story/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromAddress: client.account.address,
          toAddress: recipientAddress,
          amount: amountWei.toString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to transfer IP tokens";
        const hint = errorData.hint ? `\n\n${errorData.hint}` : "";
        throw new Error(errorMessage + hint);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Transfer failed");
      }

      setTxHash(result.txHash);
      toast.success("IP tokens transferred successfully!");
      
      // Reset form (but keep funding wallet address if it was auto-filled)
      if (fundingWalletAddress && recipientAddress === fundingWalletAddress) {
        // Keep the funding wallet address, just clear the amount
        setAmount("");
      } else {
        // Reset both if it was a custom address
        setRecipientAddress(fundingWalletAddress || "");
        setAmount("");
      }
      
      // Refresh funding wallet balance
      if (fundingWalletAddress) {
        try {
          const publicClient = createStoryPublicClient();
          const balance = await publicClient.getBalance({
            address: fundingWalletAddress as Address,
          });
          setFundingWalletBalance(formatEther(balance));
        } catch (err) {
          logger.error("Error refreshing funding wallet balance:", err);
        }
      }
      
      // Refresh balance
      setTimeout(() => {
        checkBalance();
      }, 2000); // Wait a bit for the transaction to be indexed

      if (onTransferSuccess) {
        onTransferSuccess();
      }
    } catch (err) {
      logger.error("Transfer failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Transfer failed";
      setError(errorMessage);
      toast.error(`Transfer failed: ${errorMessage}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleMaxAmount = () => {
    if (ipBalance) {
      // Leave a small amount for gas (0.01 IP)
      const gasReserve = parseEther("0.01");
      const balanceWei = parseEther(ipBalance);
      const maxAmount = balanceWei > gasReserve ? balanceWei - gasReserve : 0n;
      setAmount(formatEther(maxAmount));
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Fund Story Protocol Wallet</CardTitle>
        <CardDescription>
          Transfer IP tokens from your smart account to the funding wallet. This wallet pays for Story Protocol transactions (minting, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Funding Wallet Balance - Only show this since parent component shows user's balance */}
        {fundingWalletAddress && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-dashed">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Funding Wallet Balance:</span>
              <span className="text-xs text-muted-foreground font-mono">
                {fundingWalletAddress.slice(0, 6)}...{fundingWalletAddress.slice(-4)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isLoadingFundingWallet ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="font-medium text-foreground text-sm">
                  {fundingWalletBalance !== null ? `${fundingWalletBalance} IP` : "—"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Transfer Form */}
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">
              Funding Wallet Address
              {fundingWalletAddress && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  (Auto-filled)
                </span>
              )}
            </Label>
            <Input
              id="recipient"
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              disabled={isTransferring || !!fundingWalletAddress}
              className={fundingWalletAddress ? "bg-muted" : ""}
            />
            {fundingWalletAddress && (
              <p className="text-xs text-muted-foreground">
                This is the wallet that pays for Story Protocol transactions. You can change it if needed.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (IP)</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="text"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isTransferring}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleMaxAmount}
                disabled={isTransferring || !ipBalance}
              >
                Max
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {txHash && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Transfer successful!{" "}
                <a
                  href={`${explorerUrl}${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  View on StoryScan <ExternalLink className="h-3 w-3" />
                </a>
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isTransferring || !client?.account?.address || !recipientAddress || !amount}
          >
            {isTransferring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Transfer IP
              </>
            )}
          </Button>
        </form>

        {/* Info Alert */}
        <Alert>
          <AlertDescription className="text-sm text-muted-foreground">
            <strong>How it works:</strong> Transfer IP tokens from your smart account to the funding wallet.{" "}
            The funding wallet uses these tokens to pay for Story Protocol transactions (minting, registration, etc.).{" "}
            You pay for the IP tokens yourself, and they're used to cover transaction fees on your behalf.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

