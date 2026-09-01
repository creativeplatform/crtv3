"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useCampaignCreateAccess } from "@/lib/hooks/vote/useCampaignCreateAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useSmartAccountClient, useUser } from "@/lib/wallet/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { getProfileMembershipUrl } from "@/lib/utils/profile-urls";

interface CampaignCreateGuardProps {
  children: ReactNode;
}

export function CampaignCreateGuard({ children }: CampaignCreateGuardProps) {
  const { canCreateCampaign, isLoading, isConnected } = useCampaignCreateAccess();
  const user = useUser();
  const { address: scaAddress } = useSmartAccountClient({});
  const { account } = useModularAccount();
  const profileAddress = account?.address || scaAddress || user?.address;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect wallet</CardTitle>
          <CardDescription>
            Connect your wallet to create a Snapshot campaign.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!canCreateCampaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brand membership required</CardTitle>
          <CardDescription>
            Only Creative Brand Pass holders can create Snapshot campaigns. Upgrade
            your membership or contact the platform admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link
              href={
                profileAddress
                  ? getProfileMembershipUrl(profileAddress)
                  : "/memberships"
              }
            >
              View memberships
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
