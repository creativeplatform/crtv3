"use client";

import { Button } from "@/components/ui/button";
import { useOrbSession } from "@/context/OrbSessionContext";
import { shortenAddress } from "@/lib/utils/utils";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { useUser } from "@/lib/wallet/react";

export function MobileOrbSection() {
  const user = useUser();
  const { account: modularAccount } = useModularAccount();
  const {
    isAuthenticated: isOrbAuthenticated,
    lensAccount,
    openLoginModal: openOrbLogin,
    linkProfile,
    isLinking: isOrbLinking,
    logout: logoutOrb,
    linkStatus,
  } = useOrbSession();

  const walletAddress = modularAccount?.address || user?.address;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-semibold">Orb / Lens</p>
      {isOrbAuthenticated ? (
        <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <p
            className={
              linkStatus === "linked"
                ? "text-xs text-green-600 dark:text-green-400"
                : "text-xs text-amber-600 dark:text-amber-400"
            }
          >
            {linkStatus === "linked" ? "Linked" : "Signed in"}
            {lensAccount ? `: ${shortenAddress(lensAccount)}` : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              disabled={isOrbLinking}
              onClick={() => linkProfile(walletAddress)}
            >
              {isOrbLinking ? "Linking…" : "Sync profile"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => logoutOrb()}
            >
              Orb out
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("crtv:close-mobile-menu"));
            }
            openOrbLogin();
          }}
        >
          Sign in with Orb
        </Button>
      )}
    </div>
  );
}
