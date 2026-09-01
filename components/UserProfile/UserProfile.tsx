"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { NextPage } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import { useUser } from "@/lib/wallet/react";
import { userToAccount } from "@/lib/types/account";
import { ListUploadedAssets } from "@/components/UserProfile/list-uploaded-assets/ListUploadedAssets";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import MemberCard from "./MemberCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FaExclamationTriangle } from "react-icons/fa";
import { useMembershipContext } from "@/lib/context/MembershipContext";
import type { MembershipDetails } from "@/lib/hooks/unlock/useMembershipVerification";
import { MeTokensSection } from "./MeTokensSection";
import { UserDisplay } from "@/components/User/UserDisplay";
import { CreativeBankTab } from "./CreativeBankTab";
import { MembershipHome } from "@/components/memberships/MembershipHome";
import { CancelMembershipButton } from "./CancelMembershipButton";
import { getPassDisplayName } from "@/lib/access/membership-labels";
import { isValidProfileTab, type ProfileTab } from "@/lib/utils/profile-urls";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatorAnalyticsTab } from "./CreatorAnalyticsTab";

const LIFETIME_EXPIRATION_THRESHOLD = 32503680000;

const MEMBERSHIP_ERROR_MESSAGES: Record<string, string> = {
  LOCK_NOT_FOUND: "Unable to verify membership. Please try again later.",
  BALANCE_CHECK_ERROR: "Unable to check membership status. Please try again later.",
  MEMBERSHIP_CHECK_ERROR: "Error verifying membership. Please try again later.",
  INVALID_ADDRESS: "Invalid wallet address. Please reconnect your wallet.",
  NO_VALID_ADDRESS: "Please connect your wallet to verify membership.",
  PROVIDER_ERROR: "Network connection error. Please try again later.",
  LOCK_FETCH_ERROR: "Unable to fetch membership details. Basic verification will continue.",
  DEFAULT: "An error occurred while verifying membership.",
};

function ProfilePageGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const activeAccount = useUser();
  const account = userToAccount(activeAccount);

  useEffect(() => {
    // Relaxed guard to prevent aggressive redirects
    // if (!account?.address && typeof window !== "undefined") router.replace("/");
  }, [account?.address, router]);

  if (!account?.address) return null;
  return <>{children}</>;
}

interface ProfilePageProps {
  targetAddress?: string;
}

const ProfilePage: NextPage<ProfilePageProps> = ({ targetAddress }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const membership = useMembershipContext();
  const {
    isLoading: membershipLoading,
    error: membershipError,
    membershipDetails,
    walletAddress,
    walletType,
    refetch: refetchMembership,
  } = membership;

  const tabParam = searchParams.get("tab");
  const initialTab = isValidProfileTab(tabParam) ? tabParam : "Uploads";
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  useEffect(() => {
    if (isValidProfileTab(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Use targetAddress if provided, otherwise use the membership walletAddress
  const displayAddress = targetAddress || walletAddress;

  const handleTabChange = (value: string) => {
    if (!isValidProfileTab(value)) return;
    setActiveTab(value);
    if (!displayAddress) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value !== "Uploads") {
      params.set("tab", value);
    } else {
      params.delete("tab");
    }
    const query = params.toString();
    router.replace(
      `/profile/${displayAddress}${query ? `?${query}` : ""}`,
      { scroll: false }
    );
  };

  const switchToBankTab = () => {
    handleTabChange("Bank");
  };

  const validMembership = (
    membershipDetails as MembershipDetails[] | undefined
  )?.find((m: MembershipDetails) => m.isValid);

  const membershipErrorMessage = membershipError
    ? MEMBERSHIP_ERROR_MESSAGES[membershipError.code] ??
      MEMBERSHIP_ERROR_MESSAGES.DEFAULT
    : null;

  return (
    <ProfilePageGuard>
      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        {displayAddress && (
          <div className="mb-6">
            <UserDisplay
              address={displayAddress}
              avatarSize="lg"
              showAddress={true}
              clickable={false}
              variant="inline"
            />
          </div>
        )}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex h-auto min-h-10 w-full items-start justify-start gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
            <TabsTrigger
              value="Uploads"
              className="flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium"
            >
              Uploads
            </TabsTrigger>
            <TabsTrigger
              value="Analytics"
              className="flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium"
            >
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="MeTokens"
              className="flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium"
            >
              MeTokens
            </TabsTrigger>
            <TabsTrigger
              value="Bank"
              className="flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium"
            >
              Bank
            </TabsTrigger>
            <TabsTrigger
              value="Membership"
              className="flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium"
            >
              Membership
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="Uploads">
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl">Uploads History</CardTitle>
                  <CardDescription>
                    View and manage your uploaded videos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link
                    href="/upload"
                    className={`inline-flex items-center rounded-md bg-primary px-4 py-2 
                      text-sm font-medium text-primary-foreground hover:bg-primary/90`}
                  >
                    Upload New Video
                  </Link>
                  <div className="mt-6">
                    {displayAddress && (
                      <ListUploadedAssets
                        activeAccount={{
                          address: displayAddress,
                          type: walletType ?? "eoa",
                        }}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="Analytics">
              <CreatorAnalyticsTab />
            </TabsContent>

            <TabsContent value="MeTokens">
              <MeTokensSection walletAddress={displayAddress} />
            </TabsContent>

            <TabsContent value="Bank">
              <CreativeBankTab />
            </TabsContent>

            {/* Membership Tab Content */}
            <TabsContent value="Membership">
              {membershipLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : membershipErrorMessage ? (
                <Alert variant="destructive" className="mb-4">
                  <FaExclamationTriangle className="h-4 w-4" />
                  <AlertTitle>Membership verification failed</AlertTitle>
                  <AlertDescription>{membershipErrorMessage}</AlertDescription>
                </Alert>
              ) : validMembership ? (
                <Card>
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl">Membership</CardTitle>
                    <CardDescription>
                      Manage your membership details and benefits
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between p-4 sm:p-6 border rounded-xl bg-card">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-lg">
                            {getPassDisplayName(validMembership.address)}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-500">
                            Active
                          </span>
                        </div>
                        {validMembership.expiration && validMembership.expiration < LIFETIME_EXPIRATION_THRESHOLD ? (
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Expires on {new Date(validMembership.expiration * 1000).toISOString().split("T")[0]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const now = Date.now();
                                const exp = validMembership.expiration! * 1000;
                                const diff = exp - now;
                                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                if (days < 0) return "Expired";
                                if (days === 0) return "Expires today";
                                return `${days} day${days === 1 ? '' : 's'} remaining`;
                              })()}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Lifetime / Never expires
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        {/* Show renewal options if needed */}
                        <Button
                          variant="outline"
                          onClick={() => {
                            // Toggle renewal view locally if we want, or just scroll/show the options
                            // For now, simpler to just show the tiers below this card if they click renew?
                            // Or simpler: Just render MembershipHome below this card with a "Renew / Upgrade" header
                            const element = document.getElementById("membership-renewal-options");
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                        >
                          Extend Membership
                        </Button>
                        {validMembership.tokenId && (
                          <CancelMembershipButton
                            lockAddress={validMembership.address}
                            tokenId={validMembership.tokenId}
                            onSuccess={refetchMembership}
                          />
                        )}
                      </div>
                    </div>

                    <div id="membership-renewal-options" className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-medium">Upgrade or Renew</h3>
                      <MembershipHome
                        currentMembershipAddress={validMembership.address}
                        onPurchaseSuccess={refetchMembership}
                        onSwitchToBankTab={switchToBankTab}
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <MembershipHome
                  onPurchaseSuccess={refetchMembership}
                  onSwitchToBankTab={switchToBankTab}
                />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ProfilePageGuard>
  );
};

export default ProfilePage;

export { ProfilePageGuard };
