import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MeTokenData } from '@/lib/hooks/metokens/useMeTokens';
import { formatEther, formatUnits } from 'viem';
import { TrendingUp, TrendingDown, Users, DollarSign, Clock, Copy, Check, Coins, BarChart3 } from 'lucide-react';
import { CollateralBadge } from '@/components/metokens/CollateralBadge';
import { resolveHubAsset } from '@/lib/utils/hubAssetUtils';
import { useMeTokenMarketStats } from '@/lib/hooks/market/useMeTokenMarketStats';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface MeTokenInfoProps {
  meToken: MeTokenData;
}

export function MeTokenInfo({ meToken }: MeTokenInfoProps) {
  const { toast } = useToast();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(label);
      toast({
        title: "Copied!",
        description: `${label} address copied to clipboard`,
      });
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again manually",
        variant: "destructive",
      });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };



  // Format token amount with proper precision and responsive display
  // Returns an object with formatted number and symbol for better visual presentation
  const formatTokenAmount = (value: bigint, symbol: string, decimals: number = 18): { number: string; symbol: string } => {
    const num = parseFloat(formatUnits(value, decimals));

    if (num === 0) return { number: '0', symbol };

    let formattedNumber: string;

    // If number is very small, use more precision
    if (num < 0.00001) {
      formattedNumber = num.toExponential(3);
    } else if (num < 1) {
      // For numbers with many decimal places, limit to 6 significant digits
      const str = num.toString();
      const match = str.match(/\.(\d*)/);
      if (match && match[1].length > 6) {
        formattedNumber = parseFloat(num.toPrecision(6)).toString();
      } else {
        // Remove trailing zeros
        formattedNumber = num.toString().replace(/\.?0+$/, '');
      }
    } else {
      // For larger numbers, format with locale string
      formattedNumber = num.toLocaleString(undefined, {
        maximumFractionDigits: 6,
        minimumFractionDigits: 0
      }).replace(/\.?0+$/, '');
    }

    return { number: formattedNumber, symbol };
  };

  const collateral = resolveHubAsset(Number(meToken.info.hubId));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span className="truncate">{meToken.name}</span>
            <Badge variant="secondary" className="flex-shrink-0">${meToken.symbol}</Badge>
          </CardTitle>
          <CardDescription>
            Your personal token on the MeTokens protocol
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Responsive balance grid: stack on mobile, side-by-side on tablet+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Total Supply */}
            <div className="rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-purple-500/10">
                  <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Supply</p>
              </div>
              {(() => {
                const { number, symbol } = formatTokenAmount(meToken.totalSupply, meToken.symbol);
                return (
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight break-all sm:break-normal overflow-wrap-anywhere">
                    {number} <span className="text-lg sm:text-xl text-muted-foreground font-normal">{symbol}</span>
                  </p>
                );
              })()}
            </div>

            {/* Your Balance */}
            <div className="rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-blue-500/10">
                  <Coins className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Balance</p>
              </div>
              {(() => {
                const { number, symbol } = formatTokenAmount(meToken.balance, meToken.symbol);
                return (
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight break-all sm:break-normal overflow-wrap-anywhere">
                    {number} <span className="text-lg sm:text-xl text-muted-foreground font-normal">{symbol}</span>
                  </p>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market Data
          </CardTitle>
          <CardDescription>
            Current market information for your MeToken
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">TVL</p>
              <p className="text-lg sm:text-xl font-semibold text-green-600 break-all sm:break-normal">
                ${meToken.tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Collateral</p>
              <div className="flex flex-wrap items-center gap-2">
                <CollateralBadge hubId={Number(meToken.info.hubId)} showHubId />
                <span className="text-xs text-muted-foreground">{collateral.tagline}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Hub ID</p>
              <p className="text-lg sm:text-xl font-semibold">
                #{meToken.info.hubId.toString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Pooled Balance</p>
              {(() => {
                const { number, symbol } = formatTokenAmount(meToken.info.balancePooled, collateral.symbol, collateral.decimals);
                return (
                  <p className="text-sm sm:text-base break-all sm:break-normal overflow-wrap-anywhere">
                    {number} {symbol}
                  </p>
                );
              })()}
            </div>
            {meToken.info.balanceLocked > BigInt(0) && (
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Locked Balance</p>
                {(() => {
                  const { number, symbol } = formatTokenAmount(meToken.info.balanceLocked, collateral.symbol, collateral.decimals);
                  return (
                    <p className="text-sm sm:text-base break-all sm:break-normal overflow-wrap-anywhere">
                      {number} {symbol}
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Protocol Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Protocol Info
          </CardTitle>
          <CardDescription>
            MeTokens protocol configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">Owner</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="relative rounded bg-muted px-2 py-1.5 font-mono text-xs sm:text-sm break-all sm:break-normal overflow-wrap-anywhere">
                {formatAddress(meToken.info.owner)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-6 sm:w-6 flex-shrink-0"
                onClick={() => copyToClipboard(meToken.info.owner, 'Owner')}
              >
                {copiedAddress === 'Owner' ? (
                  <Check className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                )}
                <span className="sr-only">Copy address</span>
              </Button>
            </div>
          </div>



          {meToken.info.migration !== '0x0000000000000000000000000000000000000000' && (
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Migration</p>
              <p className="text-xs sm:text-sm font-mono bg-muted px-2 py-1.5 rounded break-all sm:break-normal overflow-wrap-anywhere">
                {formatAddress(meToken.info.migration)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Statistics
          </CardTitle>
          <CardDescription>
            Key metrics for your MeToken
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Market Cap</p>
              <p className="text-lg sm:text-xl font-semibold break-all sm:break-normal">
                ${meToken.tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Price per Token</p>
              <p className="text-lg sm:text-xl font-semibold break-all sm:break-normal">
                ${meToken.totalSupply > 0
                  ? (meToken.tvl / parseFloat(formatEther(meToken.totalSupply))).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                  : '0.0000'
                }
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-2">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">24h Change</p>
              {(() => {
                const { stats } = useMeTokenMarketStats(meToken.address);
                const priceChange = stats?.price_change_24h || 0;
                const isPositive = priceChange >= 0;

                return (
                  <div className={`flex items-center gap-1 text-lg sm:text-xl font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                  </div>
                );
              })()}
            </div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">Your Holdings Value</p>
            <p className="text-lg sm:text-xl font-semibold text-green-600 break-all sm:break-normal">
              ${meToken.totalSupply > 0
                ? (meToken.tvl * parseFloat(formatEther(meToken.balance)) / parseFloat(formatEther(meToken.totalSupply))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '0.00'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
