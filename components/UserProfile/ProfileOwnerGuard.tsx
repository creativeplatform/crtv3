"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useSmartAccountClient } from "@/lib/wallet/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { isAddress } from "viem";
import { logger } from "@/lib/utils/logger";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfileOwnerGuardProps {
  urlAddress: string;
  children: React.ReactNode;
}

/**
 * Ensures only the owner of the profile can access /profile/[address].
 * If the visitor is not logged in as that address, redirects to the creator page
 * so they can still see the public creator view.
 */
export function ProfileOwnerGuard({ urlAddress, children }: ProfileOwnerGuardProps) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const { address: scaAddress } = useSmartAccountClient({});
  const { account } = useModularAccount();
  const user = useUser();
  const eoaAddress = user?.address;

  const smartAccountAddress = account?.address || scaAddress;

  useEffect(() => {
    const normalize = (addr: string | undefined) => (addr ? addr.toLowerCase() : null);
    const urlAddr = normalize(urlAddress);
    const smartAddr = normalize(smartAccountAddress);
    const eoaAddr = normalize(eoaAddress);

    if (!urlAddress || !isAddress(urlAddress)) {
      router.replace("/");
      return;
    }

    const isOwner =
      urlAddr === smartAddr || urlAddr === eoaAddr;

    if (!isOwner) {
      logger.debug("Profile access denied: URL address is not the logged-in user, redirecting to creator page");
      router.replace(`/creator/${urlAddress}`);
      return;
    }

    setAllowed(true);
  }, [urlAddress, smartAccountAddress, eoaAddress, router, account?.address, scaAddress]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
