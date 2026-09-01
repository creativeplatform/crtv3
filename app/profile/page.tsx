"use client";
import { useEffect } from "react";
import { useUser, useSmartAccountClient } from "@/lib/wallet/react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { logger } from '@/lib/utils/logger';


function ProfileRedirect() {
  const router = useRouter();
  const { address: scaAddress } = useSmartAccountClient({});
  const { account } = useModularAccount();
  const user = useUser();
  const eoaAddress = user?.address;
  
  // Use the Smart Account address from useModularAccount as primary source
  const smartAccountAddress = account?.address || scaAddress;

  useEffect(() => {
    logger.debug('Profile redirect - EOA:', eoaAddress, 'SCA (client):', scaAddress, 'SCA (account):', account?.address);
    if (smartAccountAddress) {
      logger.debug('Redirecting to Smart Account profile:', smartAccountAddress);
      router.replace(`/profile/${smartAccountAddress}`);
    } else if (eoaAddress) {
      logger.debug('Redirecting to EOA profile:', eoaAddress);
      router.replace(`/profile/${eoaAddress}`);
    }
  }, [eoaAddress, smartAccountAddress, router, account?.address, scaAddress]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-4 w-32 rounded" />
    </div>
  );
}

export default ProfileRedirect;
