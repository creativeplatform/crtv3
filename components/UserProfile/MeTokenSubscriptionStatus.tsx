"use client";
import { MeTokenData } from '@/lib/hooks/metokens/useMeTokensSupabase';
import { useMeTokenSubscription } from '@/lib/hooks/metokens/useMeTokenSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  TrendingUp,
  RefreshCw,
  Info
} from 'lucide-react';
import { formatEther, formatUnits } from 'viem';
import { resolveHubAsset } from '@/lib/utils/hubAssetUtils';

interface MeTokenSubscriptionStatusProps {
  meToken: MeTokenData;
  onSubscribe?: () => void;
  onRefresh?: () => void;
}

export function MeTokenSubscriptionStatus({ 
  meToken, 
  onSubscribe, 
  onRefresh 
}: MeTokenSubscriptionStatusProps) {
  const collateral = resolveHubAsset(Number(meToken.info?.hubId ?? meToken.hubId));
  const {
    subscriptionState,
    isLoading,
    checkSubscriptionStatus,
    isSubscribed,
    isNotSubscribed,
    canTrade,
    requiresSubscription,
    status,
    requirementsMessage
  } = useMeTokenSubscription(meToken);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Checking subscription status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptionState) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to determine subscription status for this MeToken.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isSubscribed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Subscription Status
            </CardTitle>
            <CardDescription>
              {meToken.name} ({meToken.symbol})
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isSubscribed ? "default" : "destructive"}>
              {status === 'subscribed' ? 'Subscribed' : 'Not Subscribed'}
            </Badge>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {canTrade ? (
                <Unlock className="h-4 w-4 text-green-500" />
              ) : (
                <Lock className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">Trading Status</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {canTrade ? 'Trading enabled' : 'Trading disabled'}
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Hub ID</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {subscriptionState.hubId !== '0' ? `Hub ${subscriptionState.hubId}` : 'No hub'}
            </p>
          </div>
        </div>

        {/* Balance Information */}
        {isSubscribed && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Locked Balances</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Pooled:</span>
                <span className="ml-2 font-mono">
                  {formatUnits(BigInt(subscriptionState.balancePooled), collateral.decimals)} {collateral.symbol}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Locked:</span>
                <span className="ml-2 font-mono">
                  {formatUnits(BigInt(subscriptionState.balanceLocked), collateral.decimals)} {collateral.symbol}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Locked:</span>
                <span className="font-mono font-medium">
                  {formatUnits(BigInt(subscriptionState.totalLocked), collateral.decimals)} {collateral.symbol}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Requirements Message */}
        <Alert variant={isSubscribed ? "default" : "destructive"}>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {requirementsMessage}
          </AlertDescription>
        </Alert>

        {/* Action Button */}
        {isNotSubscribed && onSubscribe && (
          <Button onClick={onSubscribe} className="w-full">
            Subscribe to Hub
          </Button>
        )}

        {/* Additional Info for Not Subscribed */}
        {isNotSubscribed && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Why subscribe?</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Enables trading of your MeToken</li>
              <li>Locks {collateral.symbol} as collateral for price stability</li>
              <li>Allows community to buy/sell your MeToken</li>
              <li>Creates a bonding curve for price discovery</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
