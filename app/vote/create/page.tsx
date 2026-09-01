"use client";
import { useEffect } from "react";
import { useUser, useSmartAccountClient } from "@/lib/wallet/react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

function CreateVoteRedirect() {
  const router = useRouter();
  const { address: scaAddress } = useSmartAccountClient({});
  const user = useUser();
  const eoaAddress = user?.address;

  useEffect(() => {
    // Prioritize Smart Account address for the URL
    const targetAddress = scaAddress || eoaAddress;
    if (targetAddress) router.replace(`/vote/create/${targetAddress}`);
  }, [eoaAddress, scaAddress, router]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-4 w-32 rounded" />
    </div>
  );
}

export default CreateVoteRedirect;
