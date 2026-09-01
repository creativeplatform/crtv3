"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useMembershipContext } from "../../lib/context/MembershipContext";
import { type MembershipDetails } from "../../lib/hooks/unlock/useMembershipVerification";
import { getProfileMembershipUrl } from "@/lib/utils/profile-urls";
import { useSmartAccountClient, useUser } from "@/lib/wallet/react";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { LoginWithEthereumButton } from "@/components/auth/LoginWithEthereumButton";
import { LockKeyhole, ShieldCheck, ShieldX, AlertTriangle, Calendar, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPassDisplayName } from "../../lib/access/membership-labels";

function formatExpiration(expiration?: number): string {
  if (!expiration) return "Unknown";
  const ms = expiration * 1000;
  if (ms > 32503680000000) return "Lifetime / Never expires";
  const date = new Date(ms);
  if (date.toString() === "Invalid Date") return "Unknown";
  return date.toISOString().split("T")[0];
}

function isExpired(expiration?: number): boolean {
  if (!expiration) return false;
  const ms = expiration * 1000;
  if (ms > 32503680000000) return false;
  return ms < Date.now();
}

const ERROR_MESSAGES: Record<string, string> = {
  LOCK_NOT_FOUND: "Unable to verify membership. Please try again later.",
  BALANCE_CHECK_ERROR:
    "Unable to check membership status. Please try again later.",
  MEMBERSHIP_CHECK_ERROR: "Error verifying membership. Please try again later.",
  INVALID_ADDRESS: "Invalid wallet address. Please reconnect your wallet.",
  NO_VALID_ADDRESS: "Please connect your wallet to verify membership.",
  PROVIDER_ERROR: "Network connection error. Please try again later.",
  LOCK_FETCH_ERROR:
    "Unable to fetch membership details. Basic verification will continue.",
  DEFAULT: "An error occurred while verifying membership.",
};

interface MembershipSectionProps {
  className?: string;
  onNavigate?: () => void;
}

function BuyMembershipCta({
  profileAddress,
  className,
  onNavigate,
}: {
  profileAddress?: string;
  className?: string;
  onNavigate?: () => void;
}) {
  if (!profileAddress) {
    return (
      <div className={`space-y-2 ${className || ""}`}>
        <p className="text-xs text-muted-foreground">
          Connect your wallet to view pricing and purchase memberships.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <p className="text-xs text-muted-foreground">
        View pricing and purchase Unlock memberships on Base with USDC.
      </p>
      <Button asChild className="w-full bg-black hover:bg-gray-900 text-white">
        <Link
          href={getProfileMembershipUrl(profileAddress)}
          className="w-full"
          onClick={onNavigate}
        >
          Buy Membership
        </Link>
      </Button>
    </div>
  );
}

export function MembershipSection({
  className,
  onNavigate,
}: MembershipSectionProps) {
  const user = useUser();
  const { address: scaAddress } = useSmartAccountClient({});
  const { account } = useModularAccount();
  const { isVerified, hasMembership, isLoading, error, membershipDetails, walletAddress } =
    useMembershipContext();

  const profileAddress =
    walletAddress || account?.address || scaAddress || user?.address;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    const errorMessage = ERROR_MESSAGES[error.code] || ERROR_MESSAGES.DEFAULT;
    return (
      <div className={`px-2 py-2 space-y-2 ${className || ""}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        {user ? (
          <BuyMembershipCta profileAddress={profileAddress} onNavigate={onNavigate} />
        ) : (
          <LoginWithEthereumButton />
        )}
      </div>
    );
  }

  if (!isVerified) {
    if (user) {
      return (
        <div className={`px-2 py-2 space-y-2 ${className || ""}`}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldX className="h-4 w-4" />
            <span>No active membership</span>
          </div>
          <BuyMembershipCta profileAddress={profileAddress} onNavigate={onNavigate} />
        </div>
      );
    }

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldX className="h-4 w-4" />
          <span>Not verified</span>
        </div>
        <LoginWithEthereumButton />
      </div>
    );
  }

  if (!hasMembership) {
    return (
      <div className={`px-2 py-2 space-y-2 ${className || ""}`}>
        <div className="flex items-center gap-2 text-sm text-yellow-500">
          <LockKeyhole className="h-4 w-4" />
          <span>No active membership</span>
        </div>
        <BuyMembershipCta profileAddress={profileAddress} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm text-emerald-500">
        <ShieldCheck className="h-4 w-4" />
        <span>Verified Member</span>
      </div>
      {membershipDetails && membershipDetails.length > 0 && (
        <div className="space-y-3">
          {membershipDetails
            .filter(({ isValid }: MembershipDetails) => isValid)
            .map(({ address, lock, expiration }: MembershipDetails) => {
              const expired = isExpired(expiration);
              return (
              <div
                key={address}
                className="rounded-md border border-border/60 p-3 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {getPassDisplayName(address)}
                  </span>
                  {lock?.image && (
                    <img
                      src={lock.image}
                      alt=""
                      className="h-8 w-8 rounded-md object-cover"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {expired ? "Expired on" : "Expires on"}{" "}
                    {formatExpiration(expiration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <Link
                      href={profileAddress ? getProfileMembershipUrl(profileAddress) : "#"}
                      onClick={onNavigate}
                    >
                      Manage Membership
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            );})}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Access to premium features unlocked
      </div>
    </div>
  );
}
