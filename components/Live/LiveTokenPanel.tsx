"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { HeartBitProvider } from "@/components/heartbit/HeartBitProvider";
import { HeartBitTipButton } from "@/components/heartbit/HeartBitTipButton";
import { TipLedgerDrawer } from "@/components/heartbit/TipLedgerDrawer";
import { TokenPriceChart } from "@/components/Market/TokenPriceChart";
import { AlchemySwapWidget } from "@/components/wallet/swap/AlchemySwapWidget";
import { useVideoTip, type TokenSymbol, type MeTokenInfo } from "@/lib/hooks/video/useVideoTip";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { meTokenSupabaseService } from "@/lib/sdk/supabase/metokens";
import { streamTipVideoId } from "@/lib/hooks/live/useStreamTipEvents";
import { TrendingUp, ArrowRightLeft, Gift, Coins, ListOrdered } from "lucide-react";

interface CreatorMeToken {
  address: string;
  symbol: string;
  name: string;
  decimals?: number;
}

interface LiveTokenPanelProps {
  creatorAddress: string;
  creatorMeToken?: CreatorMeToken | null;
  tokenInfo?: CreatorMeToken | null;
  streamId: string;
  sessionId: string;
  /** Host sees ledger only; viewers get the tip button. */
  variant?: "host" | "viewer";
  onTipSuccess?: (txHash: string, amount: string, token: TokenSymbol) => void;
}

export function LiveTokenPanel({
  creatorAddress,
  creatorMeToken,
  tokenInfo,
  streamId,
  variant = "viewer",
  onTipSuccess,
}: LiveTokenPanelProps) {
  const [activeTab, setActiveTab] = useState("chart");
  const [streamerMeToken, setStreamerMeToken] = useState<MeTokenInfo | null>(null);
  const [isLoadingStreamerMeToken, setIsLoadingStreamerMeToken] = useState(false);
  const { balances, fetchBalances } = useVideoTip();
  const { address } = useSmartAccountClient({});

  const isCreatorWallet =
    !!address &&
    !!creatorAddress &&
    address.toLowerCase() === creatorAddress.toLowerCase();

  /** Streamer (host page or creator wallet on watch) never sees a tip button. */
  const showTipButton = variant === "viewer" && !isCreatorWallet;
  const tipVideoId = streamTipVideoId(streamId);

  // Look up the streamer's own meToken from Supabase if not already provided.
  useEffect(() => {
    if (creatorMeToken?.address || tokenInfo?.address || !creatorAddress) return;
    let cancelled = false;
    setIsLoadingStreamerMeToken(true);
    meTokenSupabaseService
      .getMeTokenByOwner(creatorAddress)
      .then((token) => {
        if (cancelled) return;
        if (token) {
          setStreamerMeToken({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: 18,
          });
        }
      })
      .catch(() => {
        // no-op: streamer may not have a meToken
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStreamerMeToken(false);
      });
    return () => {
      cancelled = true;
    };
  }, [creatorAddress, creatorMeToken, tokenInfo]);

  const displayToken = useMemo(() => {
    if (tokenInfo?.address) return tokenInfo;
    if (creatorMeToken?.address) return creatorMeToken;
    if (streamerMeToken?.address) return streamerMeToken;
    return null;
  }, [tokenInfo, creatorMeToken, streamerMeToken]);

  const meTokenBalance = useMemo(() => {
    if (!displayToken?.address) return null;
    const key = `metoken:${displayToken.address.toLowerCase()}` as TokenSymbol;
    return balances[key] ?? null;
  }, [balances, displayToken]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "tip" || value === "swap") {
      void fetchBalances(displayToken ?? undefined);
    }
  };

  return (
    <Card className="w-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {displayToken?.symbol ?? "Creator Token"}
          </CardTitle>
          {displayToken && (
            <Badge variant="outline" className="text-xs">
              {displayToken.name ?? displayToken.symbol}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chart" className="text-xs">
              <TrendingUp className="h-3.5 w-3.5 mr-1" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="swap" className="text-xs">
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
              Swap
            </TabsTrigger>
            <TabsTrigger value="tip" className="text-xs">
              {showTipButton ? (
                <Gift className="h-3.5 w-3.5 mr-1" />
              ) : (
                <ListOrdered className="h-3.5 w-3.5 mr-1" />
              )}
              {showTipButton ? "Tip" : "Tips"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="min-h-[260px]">
            {displayToken?.address ? (
              <TokenPriceChart
                tokenAddress={displayToken.address as `0x${string}`}
                tokenSymbol={displayToken.symbol}
                height={260}
              />
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                <Coins className="h-8 w-8 opacity-50" />
                <p>No creator token available for this stream.</p>
                {isLoadingStreamerMeToken && (
                  <p className="text-xs">Checking streamer token…</p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="swap">
            <div className="space-y-3">
              <AlchemySwapWidget compact hideHeader defaultToToken="USDC" />
              {meTokenBalance !== null && displayToken && (
                <p className="text-xs text-muted-foreground">
                  Your {displayToken.symbol} balance: {parseFloat(meTokenBalance).toFixed(6)}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tip">
            <div className="flex flex-col items-center justify-center min-h-[160px] gap-4">
              {showTipButton ? (
                <>
                  <HeartBitProvider chain="0x2105">
                    <div className="flex items-center gap-2">
                      <HeartBitTipButton
                        videoId={tipVideoId}
                        creatorAddress={creatorAddress}
                        onTipSuccess={onTipSuccess}
                      />
                      <TipLedgerDrawer videoId={tipVideoId} liveUpdates />
                    </div>
                  </HeartBitProvider>
                  <p className="text-xs text-muted-foreground text-center max-w-[260px]">
                    Hold the heart to tip USDC ($0.01/s). Tip as much and as often as you want.
                  </p>
                </>
              ) : (
                <>
                  <TipLedgerDrawer videoId={tipVideoId} liveUpdates />
                  <p className="text-xs text-muted-foreground text-center max-w-[260px]">
                    Tips from viewers appear here in realtime.
                  </p>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
