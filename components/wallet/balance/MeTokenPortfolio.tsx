"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMeTokenHoldings, type MeTokenHolding } from '@/lib/hooks/metokens/useMeTokenHoldings';
import { useMeTokensSupabase } from '@/lib/hooks/metokens/useMeTokensSupabase';
import {
  Wallet,
  TrendingUp,
  Users,
  Crown,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { useUser, useSmartAccountClient } from '@/lib/wallet/react';
import Link from 'next/link';
import { convertFailingGateway } from '@/lib/utils/image-gateway';
import { formatMeTokenHoldingUsd } from '@/lib/utils/meTokenHoldingValue';
import { mergeHoldingsWithOwnMeToken } from '@/lib/utils/meTokenPortfolioHoldings';

interface MeTokenPortfolioProps {
  targetAddress?: string;
  className?: string;
  /** Same list shown in the account dropdown — keeps View All in sync. */
  holdingsOverride?: MeTokenHolding[];
  onBack?: () => void;
  onRefresh?: () => Promise<void>;
}

export function MeTokenPortfolio({
  targetAddress,
  className,
  holdingsOverride,
  onBack,
  onRefresh,
}: MeTokenPortfolioProps) {
  const user = useUser();
  const { address: scaAddress } = useSmartAccountClient({});
  const ownerAddress = scaAddress || user?.address || '';

  const { holdings, loading, error, refreshHoldings } = useMeTokenHoldings(targetAddress);
  const { userMeToken, loading: meTokenLoading } = useMeTokensSupabase(targetAddress);

  const [refreshing, setRefreshing] = useState(false);

  const displayHoldings = useMemo(() => {
    if (holdingsOverride) return holdingsOverride;
    return mergeHoldingsWithOwnMeToken(holdings ?? [], userMeToken, ownerAddress);
  }, [holdingsOverride, holdings, userMeToken, ownerAddress]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        await refreshHoldings(true);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const isLoading = !holdingsOverride && (loading || meTokenLoading);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            MeToken Portfolio
          </CardTitle>
          <CardDescription>Loading your MeToken holdings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !holdingsOverride && displayHoldings.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            MeToken Portfolio
          </CardTitle>
          <CardDescription>Error loading your holdings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (displayHoldings.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            MeToken Portfolio
          </CardTitle>
          <CardDescription>No MeToken holdings found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              You don&apos;t have any MeToken holdings yet.
            </p>
            <Button asChild>
              <Link href="/explore">
                <TrendingUp className="h-4 w-4 mr-2" />
                Explore MeTokens
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ownMeToken = displayHoldings.find((h) => h.isOwnMeToken);
  const otherHoldings = displayHoldings.filter((h) => !h.isOwnMeToken);
  const totalValue = displayHoldings.reduce(
    (sum, h) => sum + (h.holdingValueUsd || 0),
    0
  );

  return (
    <div className={className}>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                {onBack && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="h-8 w-8 p-0"
                    aria-label="Back to balances"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <Wallet className="h-5 w-5" />
                MeToken Portfolio
              </CardTitle>
              <CardDescription>
                {displayHoldings.length} MeToken{displayHoldings.length !== 1 ? "s" : ""} in your
                portfolio
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {formatMeTokenHoldingUsd(totalValue)}
              </div>
              <div className="text-sm text-muted-foreground">Est. holding value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {displayHoldings.length}
              </div>
              <div className="text-sm text-muted-foreground">MeTokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {otherHoldings.length}
              </div>
              <div className="text-sm text-muted-foreground">Creators</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {ownMeToken && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Your MeToken
            </CardTitle>
            <CardDescription>MeToken you created</CardDescription>
          </CardHeader>
          <CardContent>
            <MeTokenHoldingCard holding={ownMeToken} showCreatorProfile={true} />
          </CardContent>
        </Card>
      )}

      {otherHoldings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              MeToken Holdings
            </CardTitle>
            <CardDescription className="text-xs">MeTokens from other creators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {otherHoldings.map((holding) => (
                <MeTokenHoldingCard
                  key={holding.address}
                  holding={holding}
                  showCreatorProfile={true}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MeTokenHoldingCardProps {
  holding: MeTokenHolding;
  showCreatorProfile: boolean;
}

function MeTokenHoldingCard({ holding, showCreatorProfile }: MeTokenHoldingCardProps) {
  const user = useUser();
  const { address: scaAddress } = useSmartAccountClient({});

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    } else {
      return num.toFixed(4);
    }
  };

  const formatTVL = (tvl: number) => {
    if (tvl >= 1000000) {
      return `$${(tvl / 1000000).toFixed(1)}M`;
    } else if (tvl >= 1000) {
      return `$${(tvl / 1000).toFixed(1)}K`;
    } else {
      return `$${tvl.toFixed(0)}`;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        {showCreatorProfile && (
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={holding.creatorProfile?.avatar_url ? convertFailingGateway(holding.creatorProfile.avatar_url) : undefined}
              alt={holding.creatorProfile?.username || 'Creator'}
            />
            <AvatarFallback>
              {holding.creatorProfile?.username?.charAt(0).toUpperCase() || 'C'}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{holding.name}</h3>
            <Badge variant="secondary">{holding.symbol}</Badge>
            {holding.isOwnMeToken && (
              <Badge variant="default" className="bg-primary">
                <Crown className="h-3 w-3 mr-1" />
                Yours
              </Badge>
            )}
          </div>

          {showCreatorProfile && holding.creatorProfile && (
            <p className="text-sm text-muted-foreground">
              by {holding.creatorProfile.username || 'Unknown Creator'}
            </p>
          )}

          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>Balance: {formatBalance(holding.balance)}</span>
            <span>Est. value: {formatMeTokenHoldingUsd(holding.holdingValueUsd)}</span>
            <span>Vault TVL: {formatTVL(holding.tvl)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link
            href={holding.isOwnMeToken ? `/profile/${scaAddress || user?.address}` : `/creator/${holding.ownerAddress}`}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {holding.isOwnMeToken ? 'View Profile' : 'View Creator'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
