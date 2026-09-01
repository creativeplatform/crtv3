"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVideoTip, TokenSymbol, TIP_TOKEN_OPTIONS } from "@/lib/hooks/video/useVideoTip";
import { priceService, PriceService } from "@/lib/sdk/alchemy/price-service";
import { Loader2, Coins } from "lucide-react";
import { formatAddress } from "@/lib/helpers";

interface CreatorMeToken {
  address: string;
  symbol: string;
  decimals?: number;
}

interface VideoTipButtonProps {
  creatorAddress: string;
  creatorMeToken?: CreatorMeToken | null;
  availableMeTokens?: CreatorMeToken[];
  onTipSuccess?: (txHash: string, amount: string, token: TokenSymbol) => void;
}

/**
 * Tip button component for video creators
 * Allows users to send tips in ETH, USDC, DAI, USDS, GHO, or any creator meToken they hold.
 */
export function VideoTipButton({ creatorAddress, creatorMeToken, availableMeTokens, onTipSuccess }: VideoTipButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>("ETH");
  const [amount, setAmount] = useState("");
  const [usdValue, setUsdValue] = useState("$0.00");
  const [isUsdLoading, setIsUsdLoading] = useState(false);
  const { sendTip, isTipping, error, balances, fetchBalances, getUsdValue } = useVideoTip();

  const meTokenMap = useMemo(() => {
    const map = new Map<string, CreatorMeToken>();
    if (creatorMeToken?.address) {
      map.set(creatorMeToken.address.toLowerCase(), creatorMeToken);
    }
    availableMeTokens?.forEach((t) => {
      map.set(t.address.toLowerCase(), t);
    });
    return map;
  }, [creatorMeToken, availableMeTokens]);

  const availableTokens = useMemo(() => {
    const tokens: TokenSymbol[] = [...TIP_TOKEN_OPTIONS];
    meTokenMap.forEach((token, addressKey) => {
      const key = `metoken:${addressKey}` as TokenSymbol;
      if (!tokens.includes(key)) {
        tokens.push(key);
      }
    });
    // Hide held meTokens with zero balance unless it's the primary creator token
    return tokens.filter((token) => {
      if (!token.startsWith('metoken:')) return true;
      const addressKey = token.slice('metoken:'.length).toLowerCase();
      const balance = balances[token];
      const isPrimary = creatorMeToken?.address?.toLowerCase() === addressKey;
      if (!balance || parseFloat(balance) <= 0) return isPrimary;
      return true;
    });
  }, [meTokenMap, balances, creatorMeToken]);

  // Fetch balances when dialog opens
  useEffect(() => {
    if (open) {
      fetchBalances(creatorMeToken ?? undefined);
    }
  }, [open, fetchBalances, creatorMeToken]);

  const selectedMeToken = useMemo(() => {
    if (!selectedToken.startsWith('metoken:')) return null;
    const addressKey = selectedToken.slice('metoken:'.length).toLowerCase();
    return meTokenMap.get(addressKey) ?? null;
  }, [selectedToken, meTokenMap]);

  // Compute USD value as user types / changes token
  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setUsdValue("$0.00");
        return;
      }
      setIsUsdLoading(true);
      try {
        const value = await getUsdValue(amount, selectedToken, selectedMeToken ?? creatorMeToken ?? undefined);
        if (!cancelled) {
          setUsdValue(PriceService.formatUSD(value));
        }
      } finally {
        if (!cancelled) setIsUsdLoading(false);
      }
    };
    compute();
    return () => {
      cancelled = true;
    };
  }, [amount, selectedToken, creatorMeToken, selectedMeToken, getUsdValue]);

  const handleTip = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    const result = await sendTip(amount, selectedToken, creatorAddress, selectedMeToken ?? creatorMeToken ?? undefined);

    if (result) {
      setOpen(false);
      setAmount("");
      setUsdValue("$0.00");
      onTipSuccess?.(result.txHash, result.amount, result.token);
    }
  };

  const balance = balances[selectedToken] ?? '0';
  const balanceNum = parseFloat(balance);
  const amountNum = parseFloat(amount) || 0;
  const hasInsufficientBalance = amountNum > balanceNum;

  const displaySymbol = useMemo(() => {
    if (selectedToken.startsWith('metoken:')) {
      const addressKey = selectedToken.slice('metoken:'.length).toLowerCase();
      return meTokenMap.get(addressKey)?.symbol ?? 'Creator Token';
    }
    return selectedToken;
  }, [selectedToken, meTokenMap]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Coins className="h-4 w-4" />
          Tip Creator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tip the Creator</DialogTitle>
          <DialogDescription>
            Send a tip to {formatAddress(creatorAddress)} to show your appreciation!
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleTip}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="token">Token</Label>
              <Select
                value={selectedToken}
                onValueChange={(value) => setSelectedToken(value as TokenSymbol)}
              >
                <SelectTrigger id="token">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {availableTokens.map((token) => (
                    token.startsWith('metoken:') ? (
                      <SelectItem key={token} value={token}>
                        {(() => {
                          const addressKey = token.slice('metoken:'.length).toLowerCase();
                          const info = meTokenMap.get(addressKey);
                          return info ? `${info.symbol} (MeToken)` : 'Creator Token';
                        })()}
                      </SelectItem>
                    ) : (
                      <SelectItem key={token} value={token}>
                        {token}
                      </SelectItem>
                    )
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Balance: {balanceNum.toFixed(6)} {displaySymbol}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="any"
                min="0"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isTipping}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {isUsdLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Fetching USD value...
                    </span>
                  ) : (
                    `≈ ${usdValue}`
                  )}
                </span>
                {hasInsufficientBalance && (
                  <span className="text-xs text-destructive">
                    Insufficient balance
                  </span>
                )}
              </div>
            </div>
            {error && (
              <div className="text-sm text-destructive">
                {error.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isTipping}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isTipping || !amount || amountNum <= 0 || hasInsufficientBalance}
            >
              {isTipping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Tip"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
