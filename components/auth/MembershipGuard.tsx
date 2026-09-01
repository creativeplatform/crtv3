"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMembershipVerification } from "@/lib/hooks/unlock/useMembershipVerification";
import { createContext, useContext } from "react";
import type { MembershipStatus } from "@/lib/hooks/unlock/useMembershipVerification";
import { logger } from '@/lib/utils/logger';
import { GuardLoadingFallback } from "@/components/auth/GuardLoadingFallback";


interface MembershipGuardProps {
  children: React.ReactNode;
}

export const MembershipContext = createContext<MembershipStatus | null>(null);

const PUBLIC_PATHS = [
  '/discover',
  '/market',
  '/predict',
  '/vote',
  '/news',
  '/live',
  '/watch',
  '/profile',
  '/upload',
  '/creator',
  '/memberships',
  '/songchain',
  '/chones',
];

export function MembershipGuard({ children }: MembershipGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const membership = useMembershipVerification();
  const { isVerified, hasMembership, isLoading } = membership;
  const isHomePage = pathname === "/";
  const isPublicPath = PUBLIC_PATHS.some(path => pathname?.startsWith(path));
  const canBypassLoading = isHomePage || isPublicPath;

  useEffect(() => {
    logger.debug("MembershipGuard:", {
      isLoading,
      isVerified,
      hasMembership,
      isHomePage,
      isPublicPath,
    });
    if (!isLoading && (!isVerified || !hasMembership) && !isHomePage && !isPublicPath) {
      router.push("/");
    }
  }, [isLoading, isVerified, hasMembership, router, isHomePage, isPublicPath]);

  if ((!isVerified || !hasMembership) && !isHomePage && !isPublicPath) {
    if (isLoading) {
      return (
        <GuardLoadingFallback isLoading allowBypass={false}>
          {null}
        </GuardLoadingFallback>
      );
    }
    return null;
  }

  if (isLoading && !canBypassLoading) {
    return (
      <GuardLoadingFallback
        isLoading
        allowBypass={false}
        message="Verifying membership…"
      >
        {null}
      </GuardLoadingFallback>
    );
  }

  return (
    <MembershipContext.Provider value={membership}>
      <GuardLoadingFallback
        isLoading={isLoading && canBypassLoading}
        allowBypass={canBypassLoading}
        message="Still loading your wallet session…"
      >
        {children}
      </GuardLoadingFallback>
    </MembershipContext.Provider>
  );
}

export function useMembershipContext() {
  return useContext(MembershipContext);
}
