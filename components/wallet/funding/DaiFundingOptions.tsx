"use client";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle, CreditCard, ArrowRightLeft } from 'lucide-react';
import { useSmartAccountClient } from '@/lib/wallet/react';
import { formatEther, type Address } from 'viem';
import { DAI_TOKEN_ADDRESSES } from '@/lib/contracts/DAIToken';
import { getErc20Balance } from '@/lib/viem';
import { DaiFundButton } from '@/components/wallet/buy/dai-fund-button';
import { DaiSwapButton } from '@/components/wallet/swap/DaiSwapButton';
import { logger } from '@/lib/utils/logger';


interface DaiFundingOptionsProps {
  requiredAmount?: string;
  onBalanceUpdate?: (balance: bigint) => void;
  className?: string;
}

export function DaiFundingOptions({ requiredAmount, onBalanceUpdate, className }: DaiFundingOptionsProps) {
  const [daiBalance, setDaiBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { client } = useSmartAccountClient({});

  const checkDaiBalance = useCallback(async () => {
    if (!client) return;

    setIsLoading(true);
    setError(null);

    try {
      const balance = await getErc20Balance({
        token: DAI_TOKEN_ADDRESSES.base as Address,
        owner: client.account?.address as Address,
      });

      setDaiBalance(balance);
      onBalanceUpdate?.(balance);
    } catch (err) {
      logger.error('Failed to check DAI balance:', err);
      setError('Failed to fetch DAI balance');
    } finally {
      setIsLoading(false);
    }
  }, [client, onBalanceUpdate]);

  useEffect(() => {
    if (client) {
      checkDaiBalance();
    }
  }, [client, checkDaiBalance]);

  const hasEnoughDai = requiredAmount ? daiBalance >= BigInt(requiredAmount) : daiBalance > BigInt(0);
  const hasAnyDai = daiBalance > BigInt(0);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Checking DAI balance...</span>
        </CardContent>
      </Card>
    );
  }

  if (hasEnoughDai) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            DAI Balance Sufficient
          </CardTitle>
          <CardDescription>
            You have enough DAI to proceed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>Your DAI balance: <span className="font-medium text-foreground">{formatEther(daiBalance)} DAI</span></p>
            {requiredAmount && (
              <p>Required: <span className="font-medium text-foreground">{formatEther(BigInt(requiredAmount))} DAI</span></p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          {hasAnyDai ? 'Insufficient DAI Balance' : 'No DAI Found'}
        </CardTitle>
        <CardDescription>
          {hasAnyDai
            ? `You have ${formatEther(daiBalance)} DAI, but need ${requiredAmount ? formatEther(BigInt(requiredAmount)) : 'more'} DAI.`
            : 'You need DAI to proceed. Choose an option below to get DAI.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="buy" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Buy DAI
            </TabsTrigger>
            <TabsTrigger value="swap" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Swap to DAI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="mt-4">
            <DaiFundButton
              presetAmount={requiredAmount ? Math.ceil(parseFloat(formatEther(BigInt(requiredAmount)))) : 50}
              onSuccess={() => {
                checkDaiBalance();
              }}
              className="w-full"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              <p>Buy DAI directly with fiat currency using Coinbase Onramp.</p>
            </div>
          </TabsContent>

          <TabsContent value="swap" className="mt-4">
            <DaiSwapButton
              onSwapSuccess={() => {
                checkDaiBalance();
              }}
              className="w-full"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              <p>Swap your existing tokens to DAI using a DEX aggregator.</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 text-sm text-muted-foreground">
          <p><strong>Current DAI Balance:</strong> {formatEther(daiBalance)} DAI</p>
          {requiredAmount && (
            <p><strong>Required:</strong> {formatEther(BigInt(requiredAmount))} DAI</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default DaiFundingOptions;
