"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddressWithCopy } from "@/components/Creator/AddressWithCopy";
import { convertFailingGateway } from "@/lib/utils/image-gateway";
import makeBlockie from "ethereum-blockies-base64";
import { shortenAddress } from "@/lib/utils/utils";
import { MeToken, CreatorProfile } from "@/lib/sdk/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { QuickTradeDialog } from "@/components/Market/QuickTradeDialog";
import { TokenChartDialog } from "@/components/Market/TokenChartDialog";
import { MarketToken } from "@/app/api/market/tokens/route";
import { MeTokenShareButton } from "@/components/Market/MeTokenShareButton";
import { MembershipVerifiedBadge } from "@/components/User/MembershipVerifiedBadge";
import { CreatorPredictButton } from "@/components/Creator/CreatorPredictButton";

interface CreatorProfileHeaderProps {
  address: string;
  creatorProfile: CreatorProfile | null;
  meToken: MeToken | null;
  bio: string | null;
}

export function CreatorProfileHeader({
  address,
  creatorProfile,
  meToken,
  bio,
}: CreatorProfileHeaderProps) {
  // Determine display name and symbol
  const displayName = meToken?.name || creatorProfile?.username || shortenAddress(address);
  const displaySymbol = meToken?.symbol || null;
  const avatarUrl = creatorProfile?.avatar_url
    ? convertFailingGateway(creatorProfile.avatar_url)
    : makeBlockie(address);

  const avatarFallback = displayName
    ? displayName.charAt(0).toUpperCase()
    : displaySymbol
      ? displaySymbol.slice(0, 2).toUpperCase()
      : address.slice(2, 3).toUpperCase() || "C";

  const [quickTradeOpen, setQuickTradeOpen] = useState(false);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);

  // Convert MeToken to MarketToken for dialogs
  const marketToken: MarketToken | null = meToken ? {
    id: meToken.id,
    address: meToken.address,
    name: meToken.name,
    symbol: meToken.symbol,
    owner_address: meToken.owner_address,
    type: 'metoken',
    price: 0, // Placeholder
    tvl: meToken.tvl,
    total_supply: meToken.total_supply?.toString() || '0',
    market_cap: meToken.tvl,
    created_at: meToken.created_at,
    creator_username: creatorProfile?.username,
    creator_avatar_url: creatorProfile?.avatar_url,
  } : null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
      <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
        <AvatarImage src={avatarUrl} alt={displayName} />
        <AvatarFallback>
          {avatarFallback}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h1 className="text-3xl font-bold">{displayName}</h1>
          {displaySymbol && (
            <Badge variant="secondary" className="text-sm">
              {displaySymbol}
            </Badge>
          )}
        </div>
        <div className="mb-4">
          <AddressWithCopy address={address} />
        </div>

        {creatorProfile?.username && (
          <p className="text-lg font-medium mb-2 flex items-center gap-1.5">
            {creatorProfile.username}
            <MembershipVerifiedBadge address={address} size="md" />
          </p>
        )}

        {bio && (
          <p className="text-sm text-muted-foreground max-w-2xl">
            {bio}
          </p>
        )}

        {marketToken && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="default"
              size="sm"
              onClick={() => setQuickTradeOpen(true)}
            >
              Quick Trade
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChartDialogOpen(true)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Chart
            </Button>
            <CreatorPredictButton
              creatorAddress={address}
              creatorName={creatorProfile?.username || marketToken.name}
            />
            <MeTokenShareButton
              address={marketToken.address}
              symbol={marketToken.symbol}
              name={marketToken.name}
              type="creator"
            />
          </div>
        )}
      </div>

      <QuickTradeDialog
        open={quickTradeOpen}
        onOpenChange={setQuickTradeOpen}
        token={marketToken}
      />

      {marketToken && (
        <TokenChartDialog
          open={chartDialogOpen}
          onOpenChange={setChartDialogOpen}
          token={marketToken}
        />
      )}
    </div>
  );
}

