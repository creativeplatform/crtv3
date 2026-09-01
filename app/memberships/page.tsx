"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useSmartAccountClient } from "@/lib/wallet/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginWithEthereumButton } from "@/components/auth/LoginWithEthereumButton";
import { getProfileMembershipUrl } from "@/lib/utils/profile-urls";

export default function MembershipsPage() {
  const router = useRouter();
  const user = useUser();
  const { address: scaAddress } = useSmartAccountClient({});
  const { account } = useModularAccount();
  const smartAccountAddress = account?.address || scaAddress;
  const primaryAddress = smartAccountAddress || user?.address;

  useEffect(() => {
    if (primaryAddress) {
      router.replace(getProfileMembershipUrl(primaryAddress));
    }
  }, [primaryAddress, router]);

  if (primaryAddress) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-6">
      <h1 className="text-2xl font-bold">Memberships</h1>
      <p className="text-muted-foreground">
        Connect your wallet to view pricing, purchase, and manage your membership
        from your profile.
      </p>
      <LoginWithEthereumButton />
    </div>
  );
}
