"use client";
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMeTokensSupabase, MeTokenData } from '@/lib/hooks/metokens/useMeTokensSupabase';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Lock, ExternalLink } from 'lucide-react';
import { formatEther, formatUnits, parseEther, parseUnits, encodeFunctionData, type Address } from 'viem';
import { useSmartAccountClient, useChain, useAuthModal, useUser } from '@/lib/wallet/react';
import { MeTokenSubscription } from './MeTokenSubscription';
import { FundingOptions } from '@/components/wallet/buy/FundingOptions';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/lib/utils/logger';
import { getErc20Balance } from '@/lib/viem';
import { resolveHubAsset } from '@/lib/utils/hubAssetUtils';
import {
  clearMeTokenHoldingsCache,
} from '@/lib/hooks/metokens/useMeTokenHoldings';
import { notifyMeTokenBalancesChanged } from '@/lib/hooks/metokens/meTokenBalanceEvents';

interface MeTokenTradingProps {
  meToken: MeTokenData;
  onRefresh?: () => Promise<void>;
}

export function MeTokenTrading({ meToken, onRefresh }: MeTokenTradingProps) {
  const collateral = resolveHubAsset(Number(meToken.info?.hubId ?? meToken.hubId));
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [buyPreview, setBuyPreview] = useState('0');
  const [sellPreview, setSellPreview] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<React.ReactNode | null>(null);

  // Initialize subscription status from meToken prop data immediately
  // This prevents showing "not subscribed" while waiting for blockchain check
  const getInitialSubscriptionStatus = (meToken: MeTokenData): boolean => {
    // Check balancePooled and balanceLocked directly from prop data
    const balancePooled = meToken.info?.balancePooled ?? BigInt(0);
    const balanceLocked = meToken.info?.balanceLocked ?? BigInt(0);
    return balancePooled > BigInt(0) || balanceLocked > BigInt(0);
  };

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(() =>
    getInitialSubscriptionStatus(meToken)
  );
  const [collateralBalance, setCollateralBalance] = useState<bigint>(BigInt(0));
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);

  const { client } = useSmartAccountClient({});
  const { chain } = useChain();
  const { openAuthModal } = useAuthModal();
  const user = useUser();
  const walletAddress = client?.account?.address ?? user?.address;
  const { toast } = useToast();
  const isConnected = !!user && !!client;

  const {
    buyMeTokens,
    sellMeTokens,
    calculateMeTokensMinted,
    calculateAssetsReturned,
    isPending,
    isConfirming,
    isConfirmed,
    transactionError,

  } = useMeTokensSupabase();

  // Check if MeToken is subscribed using the blockchain utility function
  // Falls back to meToken prop data if blockchain check fails
  const checkSubscriptionStatus = useCallback(async () => {
    if (!client || !meToken.address) return;

    // First, check subscription status from meToken prop data (fast, from database)
    const { isMeTokenSubscribed } = await import('@/lib/utils/metokenSubscriptionUtils');
    const propSubscriptionStatus = isMeTokenSubscribed(meToken);
    logger.debug('🔍 Subscription status from prop data:', propSubscriptionStatus, {
      balancePooled: meToken.info?.balancePooled?.toString(),
      balanceLocked: meToken.info?.balanceLocked?.toString(),
      hubId: meToken.hubId
    });

    // Set initial status from prop data
    setIsSubscribed(propSubscriptionStatus);

    // Then verify with blockchain check (slower, but more accurate)
    setIsCheckingSubscription(true);
    try {
      logger.debug('🔍 Verifying subscription status from blockchain:', meToken.address);
      const { checkMeTokenSubscriptionFromBlockchain } = await import('@/lib/utils/metokenSubscriptionUtils');
      const status = await checkMeTokenSubscriptionFromBlockchain(meToken.address);
      logger.debug('✅ Blockchain subscription status:', status);

      // Use blockchain result if available, otherwise keep prop data result
      if (!status.error) {
        setIsSubscribed(status.isSubscribed);
      } else {
        logger.warn('⚠️ Blockchain check failed, using prop data:', status.error);
        // Keep the prop data result we set earlier
      }
    } catch (err) {
      logger.error('Failed to check subscription status from blockchain:', err);
      // Keep the prop data result we set earlier instead of defaulting to false
      logger.debug('ℹ️ Using subscription status from prop data due to blockchain check failure');
    } finally {
      setIsCheckingSubscription(false);
    }
  }, [client, meToken]);

  // Check collateral balance
  const checkCollateralBalance = useCallback(async () => {
    if (!client) return;

    try {
      const balance = await getErc20Balance({
        token: collateral.address as Address,
        owner: client.account?.address as Address,
      });

      setCollateralBalance(balance);
    } catch (err) {
      logger.error('Failed to check collateral balance:', err);
      setCollateralBalance(BigInt(0));
    }
  }, [client, collateral.address]);





  // Check subscription status on mount and when meToken data changes
  useEffect(() => {
    checkSubscriptionStatus();
    checkCollateralBalance();
  }, [meToken.address, meToken.info?.balancePooled, meToken.info?.balanceLocked, meToken.hubId, checkSubscriptionStatus, checkCollateralBalance]);

  // Calculate buy preview when amount changes
  useEffect(() => {
    const calculateBuyPreview = async () => {
      if (buyAmount && parseFloat(buyAmount) > 0) {
        try {
          const preview = await calculateMeTokensMinted(meToken.address, buyAmount);
          setBuyPreview(preview);
        } catch (err) {
          logger.error('Failed to calculate buy preview:', err);
        }
      } else {
        setBuyPreview('0');
      }
    };

    calculateBuyPreview();
  }, [buyAmount, calculateMeTokensMinted, meToken.address]);

  // Calculate sell preview when amount changes
  useEffect(() => {
    const calculateSellPreview = async () => {
      if (sellAmount && parseFloat(sellAmount) > 0) {
        try {
          const preview = await calculateAssetsReturned(meToken.address, sellAmount);
          setSellPreview(preview);
        } catch (err) {
          logger.error('Failed to calculate sell preview:', err);
        }
      } else {
        setSellPreview('0');
      }
    };

    calculateSellPreview();
  }, [sellAmount, calculateAssetsReturned, meToken.address]);

  const handleBuy = async () => {
    logger.debug('🛒 Buy button clicked', { buyAmount, meToken });

    // Check if wallet is connected first
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to make a purchase.",
        variant: "destructive",
      });
      openAuthModal();
      return;
    }

    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      setError('Please enter a valid amount');
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (!meToken) {
      logger.error('❌ MeToken not available', { meToken });
      setError('MeToken information not available');
      toast({
        title: "Error",
        description: "MeToken information not available",
        variant: "destructive",
      });
      return;
    }

    if (!client) {
      logger.error('❌ Smart account client not initialized');
      setError('Wallet not connected. Please connect your wallet.');
      toast({
        title: "Error",
        description: "Wallet not connected. Please connect your wallet.",
        variant: "destructive",
      });
      openAuthModal();
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      logger.debug('💰 Starting purchase...', {
        meTokenAddress: meToken.address,
        amount: buyAmount,
      });

      logger.debug('🔄 Calling buyMeTokens...');
      const hash = await buyMeTokens(meToken.address, buyAmount);
      logger.debug('✅ Buy order submitted successfully!');
      setSuccess(
        <div className="flex flex-col gap-1">
          <span>Buy order submitted!</span>
          {hash && (
            <a
              href={`https://basescan.org/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline flex items-center gap-1"
            >
              View on Explorer <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );
      setBuyAmount('');

      // Show success toast
      toast({
        title: "Purchase Successful",
        description: `Successfully purchased ${parseFloat(buyPreview).toFixed(4)} ${meToken.symbol}`,
      });

      // Refresh balances
      await checkCollateralBalance();

      if (walletAddress) {
        clearMeTokenHoldingsCache(walletAddress);
        notifyMeTokenBalancesChanged(walletAddress);
      }
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      logger.error('❌ Error in handleBuy:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to buy MeTokens';
      setError(errorMessage);
      setSuccess(null);

      // Show error toast
      toast({
        title: "Purchase Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleSell = async () => {
    logger.debug('💸 Sell button clicked', { sellAmount, meToken, balance: meToken.balance });

    // Check if wallet is connected first
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to sell tokens.",
        variant: "destructive",
      });
      openAuthModal();
      return;
    }

    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      setError('Please enter a valid amount');
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (!meToken) {
      logger.error('❌ MeToken not available', { meToken });
      setError('MeToken information not available');
      toast({
        title: "Error",
        description: "MeToken information not available",
        variant: "destructive",
      });
      return;
    }

    if (!client) {
      logger.error('❌ Smart account client not initialized');
      setError('Wallet not connected. Please connect your wallet.');
      toast({
        title: "Error",
        description: "Wallet not connected. Please connect your wallet.",
        variant: "destructive",
      });
      openAuthModal();
      return;
    }

    const sellAmountWei = parseEther(sellAmount);
    if (meToken.balance < sellAmountWei) {
      setError(`Insufficient balance. You have ${formatEther(meToken.balance)} ${meToken.symbol}`);
      toast({
        title: "Insufficient Balance",
        description: `You have ${formatEther(meToken.balance)} ${meToken.symbol}`,
        variant: "destructive",
      });
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      logger.debug('💸 Starting sale...', {
        meTokenAddress: meToken.address,
        amount: sellAmount,
        meTokenBalance: meToken.balance.toString(),
      });

      logger.debug('🔄 Calling sellMeTokens...');
      const hash = await sellMeTokens(meToken.address, sellAmount);
      logger.debug('✅ Sell order submitted successfully!');
      setSuccess(
        <div className="flex flex-col gap-1">
          <span>Sell order submitted!</span>
          {hash && (
            <a
              href={`https://basescan.org/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline flex items-center gap-1"
            >
              View on Explorer <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );
      setSellAmount('');

      // Show success toast
      toast({
        title: "Sale Successful",
        description: `Successfully sold ${sellAmount} ${meToken.symbol} for ${parseFloat(sellPreview).toFixed(4)} ${collateral.symbol}`,
      });

      // Refresh balances
      await checkCollateralBalance();

      if (walletAddress) {
        clearMeTokenHoldingsCache(walletAddress);
        notifyMeTokenBalancesChanged(walletAddress);
      }
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      logger.error('❌ Error in handleSell:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to sell MeTokens';
      setError(errorMessage);
      setSuccess(null);

      // Show error toast
      toast({
        title: "Sale Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const isLoading = isPending || isConfirming;

  // Show loading state while checking subscription
  if (isCheckingSubscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Trade {meToken.symbol}</span>
            <Loader2 className="h-4 w-4 animate-spin" />
          </CardTitle>
          <CardDescription>Checking subscription status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show subscription component if MeToken is not subscribed
  if (isSubscribed === false) {
    return (
      <div className="space-y-4">
        <Card>
          {/* ... existing card content ... */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Trade {meToken.symbol}</span>
              <Lock className="h-5 w-5 text-orange-500" />
            </CardTitle>
            <CardDescription>
              This MeToken is not subscribed to any hub yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Trading is not available for unsubscribed MeTokens. Please subscribe your MeToken to a hub first to enable trading.
              </AlertDescription>
            </Alert>

            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>MeToken Info:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Total Supply: {parseFloat(formatEther(meToken.totalSupply)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {meToken.symbol}</li>
                <li>TVL: ${meToken.tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                <li>Your Balance: {parseFloat(formatEther(meToken.balance)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {meToken.symbol}</li>
                <li>Status: Not Subscribed</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <MeTokenSubscription
          meToken={meToken}
          onSubscriptionSuccess={() => {
            // Refresh subscription status
            checkSubscriptionStatus();
            // Refresh parent data to update balance
            if (onRefresh) {
              setTimeout(() => onRefresh(), 2000);
            }
          }}
        />
      </div>
    );
  }

  // Show collateral funding options first if user has no collateral
  if (collateralBalance === BigInt(0)) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Trade {meToken.symbol}</span>
              <AlertCircle className="h-5 w-5 text-orange-500" />
            </CardTitle>
            <CardDescription>
              You need {collateral.symbol} to trade {meToken.name} tokens.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Trading requires {collateral.symbol}. Please get {collateral.symbol} first to enable trading.
              </AlertDescription>
            </Alert>

            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>MeToken Info:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Total Supply: {parseFloat(formatEther(meToken.totalSupply)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {meToken.symbol}</li>
                <li>TVL: ${meToken.tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                <li>Your Balance: {parseFloat(formatEther(meToken.balance)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {meToken.symbol}</li>
                <li>Your {collateral.symbol} Balance: {parseFloat(formatUnits(collateralBalance, collateral.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {collateral.symbol}</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {collateral.symbol === 'USDC' ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Get {collateral.symbol}
              </CardTitle>
              <CardDescription>
                You need {collateral.symbol} to trade {meToken.name} tokens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FundingOptions
                asset="USDC"
                presetFiatAmount={50}
                onSuccess={() => checkCollateralBalance()}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Get {collateral.symbol}
              </CardTitle>
              <CardDescription>
                You need {collateral.symbol} to trade this MeToken.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {collateral.symbol} is not available via direct on-ramp. Please swap from another token (e.g. USDC, ETH) using a DEX aggregator like Uniswap or Aerodrome.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Trade {meToken.symbol}</span>
          {isConfirmed && <CheckCircle className="h-5 w-5 text-green-500" />}
        </CardTitle>
        <CardDescription>
          Buy and sell {meToken.name} tokens. Your balance: {parseFloat(formatEther(meToken.balance)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {meToken.symbol}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}

        {transactionError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="break-words">
              Transaction failed: {transactionError.message}
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {!isConnected && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              Connect your wallet to trade tokens
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="buy" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <TrendingUp className="h-4 w-4" />
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="flex items-center gap-2 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <TrendingDown className="h-4 w-4" />
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="buyAmount">{collateral.symbol} Amount to Spend</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={isLoading || !isConnected}
                  onClick={() => setBuyAmount(formatUnits(collateralBalance, collateral.decimals))}
                >
                  MAX
                </Button>
              </div>
              <Input
                id="buyAmount"
                type="number"
                placeholder="0.00"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                disabled={isLoading}
                step="0.01"
                min="0"
              />
              <p className="text-sm text-muted-foreground">
                You will receive approximately {parseFloat(buyPreview).toLocaleString(undefined, { maximumFractionDigits: 4 })} {meToken.symbol} tokens
              </p>
              {buyAmount && parseFloat(buyAmount) > 0 && (
                <div className="text-sm space-y-1">
                  <div>
                    {collateralBalance >= parseUnits(buyAmount, collateral.decimals) ? (
                      <span className="text-green-600">✓ {collateral.symbol} balance sufficient</span>
                    ) : (
                      <span className="text-red-600">⚠ Insufficient {collateral.symbol} balance</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {buyAmount && parseFloat(buyAmount) > 0 && collateralBalance < parseUnits(buyAmount, collateral.decimals) && (
              collateral.symbol === 'USDC' ? (
                <FundingOptions
                  asset="USDC"
                  presetFiatAmount={Math.ceil(parseFloat(buyAmount))}
                  onSuccess={() => checkCollateralBalance()}
                />
              ) : (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Insufficient {collateral.symbol} balance. Please swap for {collateral.symbol} using a DEX aggregator like Uniswap or Aerodrome.
                  </AlertDescription>
                </Alert>
              )
            )}

            {!isConnected ? (
              <Button
                onClick={() => openAuthModal()}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                Connect Wallet to Buy
              </Button>
            ) : (
              <Button
                onClick={handleBuy}
                disabled={isLoading || !buyAmount || parseFloat(buyAmount) <= 0 || collateralBalance < parseUnits(buyAmount || '0', collateral.decimals)}
                className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isPending ? 'Buying...' : isConfirming ? 'Confirming...' : 'Processing...'}
                  </>
                ) : (
                  `Buy ${meToken.symbol}`
                )}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="sell" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sellAmount">{meToken.symbol} Amount to Sell</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={isLoading || !isConnected || meToken.balance <= 0n}
                  onClick={() => setSellAmount(formatEther(meToken.balance))}
                >
                  MAX
                </Button>
              </div>
              <Input
                id="sellAmount"
                type="number"
                placeholder="0.00"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                disabled={isLoading}
                step="0.01"
                min="0"
                max={formatEther(meToken.balance)}
              />
              <p className="text-sm text-muted-foreground">
                You will receive approximately {parseFloat(sellPreview).toLocaleString(undefined, { maximumFractionDigits: 4 })} {collateral.symbol}
              </p>
            </div>

            {!isConnected ? (
              <Button
                onClick={() => openAuthModal()}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                Connect Wallet to Sell
              </Button>
            ) : (
              <Button
                onClick={handleSell}
                disabled={isLoading || !sellAmount || parseFloat(sellAmount) <= 0}
                className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isPending ? 'Selling...' : isConfirming ? 'Confirming...' : 'Processing...'}
                  </>
                ) : (
                  `Sell ${meToken.symbol}`
                )}
              </Button>
            )}
          </TabsContent>
        </Tabs>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>MeToken Info:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Total Supply: {parseFloat(formatEther(meToken.totalSupply)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {meToken.symbol}</li>
            <li>TVL: ${meToken.tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
            <li>Your Balance: {parseFloat(formatEther(meToken.balance)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {meToken.symbol}</li>
          </ul>
          <p className="text-xs">
            Note: Selling MeTokens incurs a 20% stability fee to prevent pump-and-dump attacks.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
