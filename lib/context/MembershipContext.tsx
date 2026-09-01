"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useMembershipVerification,
  type MembershipStatus,
} from "@/lib/hooks/unlock/useMembershipVerification";

const MembershipContext = createContext<MembershipStatus | null>(null);

export function MembershipProvider({ children }: { children: ReactNode }) {
  const status = useMembershipVerification();
  return (
    <MembershipContext.Provider value={status}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembershipContext(): MembershipStatus {
  const ctx = useContext(MembershipContext);
  if (!ctx) {
    throw new Error(
      "useMembershipContext must be used within MembershipProvider"
    );
  }
  return ctx;
}
